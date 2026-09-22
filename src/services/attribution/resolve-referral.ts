import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { referralClicks } from "@/db/schema/referral-clicks";
import { sponsorships } from "@/db/schema/sponsorships";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { findProfileById } from "@/repositories/profiles";

// Shared by app/r/[code]/route.ts (sets it) and
// app/dashboard/courses/[courseId]/purchase-actions.ts (reads it) — kept
// here so the two can never drift on the cookie's name.
export const REFERRAL_COOKIE_NAME = "mlm_ref";

// Records a click on an ambassador's referral link (/r/{referralCode}) — one
// row per click, a dedicated tracking table rather than a bare cookie (see
// db/schema/referral-clicks.ts for why). Returns the fresh visitorToken the
// caller (the route handler) sets as a cookie; resolveAttribution reads it
// back later, at purchase time. Returns null for an unknown or inactive
// referral code — the route handler still redirects the visitor somewhere
// sensible either way, it just doesn't set a tracking cookie.
export async function recordReferralClick(input: {
  referralCode: string;
  courseId?: string;
  landingPath?: string;
}): Promise<{ visitorToken: string; ambassadorUserId: string } | null> {
  const ambassador = await db.query.ambassadorProfiles.findFirst({
    where: eq(ambassadorProfiles.referralCode, input.referralCode),
  });
  if (!ambassador || ambassador.status !== "ACTIVE") {
    return null;
  }

  const visitorToken = randomUUID();
  await db.insert(referralClicks).values({
    ambassadorUserId: ambassador.userId,
    visitorToken,
    courseId: input.courseId,
    landingPath: input.landingPath,
  });

  return { visitorToken, ambassadorUserId: ambassador.userId };
}

// Resolves a visitor's cookie to the ambassador who should get credit for a
// sale, if any — the most recent click for this token still inside the
// configurable attribution window (parameter_versions key
// attribution.cookie_days). Returns null (not an error) when there's no
// cookie, no matching click, or the click has aged out of the window — a
// direct purchase with no attribution is a normal, expected outcome
// (section 9 of the master prompt), never a failure.
export async function resolveAttribution(
  visitorToken: string | undefined,
): Promise<{ ambassadorUserId: string; attributionId: string } | null> {
  if (!visitorToken) return null;

  const windowDays = await getCurrentParameterValue(
    db,
    "attribution.cookie_days",
  );
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const click = await db.query.referralClicks.findFirst({
    where: and(
      eq(referralClicks.visitorToken, visitorToken),
      gte(referralClicks.clickedAt, cutoff),
    ),
    orderBy: desc(referralClicks.clickedAt),
  });

  if (!click) return null;
  return {
    ambassadorUserId: click.ambassadorUserId,
    attributionId: click.id,
  };
}

// Who actually gets credited for a sale — product decision: the sponsor the
// buyer explicitly named (register-form.tsx's "Pseudo du parrain", written
// once and permanently to `sponsorships`) outranks the referral-link cookie.
// A deliberately typed pseudo is a real identification of the referrer; a
// click cookie is just whichever link happened to be clicked most recently
// and can be overwritten by clicking someone else's link afterwards. Falls
// back to the cookie (resolveAttribution) when the buyer has no sponsorship
// on file, or when their recorded sponsor isn't (or no longer is) an active
// ambassador — a non-ambassador sponsor has no referral code and can't
// receive a commission, so the click is the only real signal left.
export async function resolveSaleAttribution(
  buyerUserId: string,
  visitorToken: string | undefined,
): Promise<{ ambassadorUserId: string; attributionId: string | null } | null> {
  const sponsorship = await db.query.sponsorships.findFirst({
    where: eq(sponsorships.userId, buyerUserId),
  });
  if (sponsorship) {
    const sponsorAmbassador = await db.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, sponsorship.sponsorId),
    });
    if (sponsorAmbassador?.status === "ACTIVE") {
      // No click backs a pseudo-based attribution, so there's no
      // referral_clicks row to point attributionId at.
      return { ambassadorUserId: sponsorship.sponsorId, attributionId: null };
    }
  }
  return resolveAttribution(visitorToken);
}

// Live prefill for register-form.tsx's "Pseudo du parrain" field when the
// visitor arrived via a referral link but the registration page's own
// ?sponsor= query param isn't set — without this, a click-through visitor
// who never types a pseudo ends up with no `sponsorships` row at all despite
// resolveSaleAttribution crediting their sponsor's sale later, and no
// permanent sponsor recorded for when they eventually join the ambassador
// program themselves (join-program.ts).
export async function resolveReferralUsername(
  visitorToken: string | undefined,
): Promise<string | null> {
  const attribution = await resolveAttribution(visitorToken);
  if (!attribution) return null;
  const sponsor = await findProfileById(attribution.ambassadorUserId);
  return sponsor?.username ?? null;
}
