import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { referralClicks } from "@/db/schema/referral-clicks";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";

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
