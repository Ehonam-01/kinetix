import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import {
  marketingSettings,
  marketingVisits,
  signupSources,
} from "@/db/schema/marketing";
import { profiles } from "@/db/schema/profiles";
import { isUuid } from "@/lib/utils";
import { logAdminAction } from "@/services/admin/audit-log";

// Campaign tracking (Admin → Marketing). A visitor arriving from a campaign
// link (utm_* parameters) or from another site is recorded
// (marketing_visits); the first such visit of their browser is kept in a
// cookie (MARKETING_COOKIE_NAME: "<visitor token>.<first visit id>", first
// touch) and copied to signup_sources when they sign up — so each sign-up,
// and the subscription it leads to, is credited to the campaign that
// brought the visitor.
export const MARKETING_COOKIE_NAME = "kx_mkt";
export const MARKETING_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const MAX_FIELD = 100;

const clean = (value: unknown) => {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase().slice(0, MAX_FIELD);
  return v ? v : null;
};

export type VisitInput = {
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  referrer?: unknown;
  landingPath?: unknown;
};

// The outside site the visitor came from (facebook.com, google.com…), or
// null for none / our own site.
export function referrerHostOf(referrer: unknown, ownHost: string) {
  if (typeof referrer !== "string" || !referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const own = ownHost
      .toLowerCase()
      .replace(/^www\./, "")
      .split(":")[0];
    if (!host || host === own || host.endsWith(`.${own}`)) return null;
    return host.slice(0, MAX_FIELD);
  } catch {
    return null;
  }
}

export function parseMarketingCookie(value: string | undefined) {
  const [token, firstVisitId] = (value ?? "").split(".");
  return isUuid(token) && isUuid(firstVisitId) ? { token, firstVisitId } : null;
}

// Records one arrival. Returns the cookie value to set — unchanged when the
// browser already has one (the first visit stays the one credited).
export async function recordMarketingVisit(
  input: VisitInput,
  ownHost: string,
  existingCookie: string | undefined,
) {
  const utmSource = clean(input.utmSource);
  const referrerHost = referrerHostOf(input.referrer, ownHost);
  // Nothing to attribute: a direct visit or a click inside the site.
  if (!utmSource && !referrerHost) return null;

  const landing =
    typeof input.landingPath === "string" && input.landingPath.startsWith("/")
      ? input.landingPath.slice(0, 200)
      : "/";
  const existing = parseMarketingCookie(existingCookie);
  const token = existing?.token ?? randomUUID();

  const [visit] = await db
    .insert(marketingVisits)
    .values({
      visitorToken: token,
      utmSource,
      utmMedium: clean(input.utmMedium),
      utmCampaign: clean(input.utmCampaign),
      utmContent: clean(input.utmContent),
      utmTerm: clean(input.utmTerm),
      referrerHost,
      landingPath: landing,
    })
    .returning();

  return existing ? null : `${token}.${visit.id}`;
}

// At profile creation (ensure-profile.ts): the campaign of the visit the
// sign-up came from. visitId comes from user metadata (user-controlled):
// only an existing visit is ever copied.
export async function attachSignupSource(
  executor: Executor,
  userId: string,
  visitId: unknown,
) {
  if (!isUuid(visitId)) return;
  const visit = await executor.query.marketingVisits.findFirst({
    where: eq(marketingVisits.id, visitId),
  });
  if (!visit) return;
  await executor
    .insert(signupSources)
    .values({
      userId,
      visitId: visit.id,
      utmSource: visit.utmSource,
      utmMedium: visit.utmMedium,
      utmCampaign: visit.utmCampaign,
      utmContent: visit.utmContent,
      referrerHost: visit.referrerHost,
    })
    .onConflictDoNothing();
}

// ---------------------------------------------------------------- report

export type CampaignRow = {
  source: string;
  campaign: string | null;
  visits: number;
  visitors: number;
  signups: number;
  paid: number;
  revenue: number;
};

// Per source and campaign over the last `days` days: visits, distinct
// visitors, sign-ups, sign-ups that paid a subscription, and what those
// first subscriptions brought in. Sign-ups with no recorded source are
// one more row (source "direct").
export async function getCampaignReport(days: number) {
  const since = sql`now() - make_interval(days => ${days})`;
  const sourceKey = sql`coalesce(utm_source, 'site:' || referrer_host)`;

  const visits = await db.execute<{
    source: string;
    campaign: string | null;
    visits: number;
    visitors: number;
  }>(sql`
    SELECT ${sourceKey} AS source, utm_campaign AS campaign,
      count(*)::int AS visits, count(DISTINCT visitor_token)::int AS visitors
    FROM marketing_visits
    WHERE created_at >= ${since}
    GROUP BY 1, 2
  `);

  const signups = await db.execute<{
    source: string;
    campaign: string | null;
    signups: number;
    paid: number;
    revenue: number;
  }>(sql`
    WITH members AS (
      SELECT p.id,
        coalesce(ss.utm_source, 'site:' || ss.referrer_host, 'direct') AS source,
        ss.utm_campaign AS campaign,
        (SELECT s.price_paid FROM subscriptions s
          WHERE s.user_id = p.id ORDER BY s.created_at LIMIT 1) AS first_price
      FROM profiles p
      LEFT JOIN signup_sources ss ON ss.user_id = p.id
      WHERE p.created_at >= ${since} AND p.role = 'USER'
    )
    SELECT source, campaign, count(*)::int AS signups,
      count(first_price)::int AS paid,
      coalesce(sum(first_price), 0)::int AS revenue
    FROM members
    GROUP BY 1, 2
  `);

  const rows = new Map<string, CampaignRow>();
  const keyOf = (source: string, campaign: string | null) =>
    `${source}\u0000${campaign ?? ""}`;
  for (const v of visits) {
    rows.set(keyOf(v.source, v.campaign), {
      source: v.source,
      campaign: v.campaign,
      visits: v.visits,
      visitors: v.visitors,
      signups: 0,
      paid: 0,
      revenue: 0,
    });
  }
  for (const s of signups) {
    const key = keyOf(s.source, s.campaign);
    const row = rows.get(key) ?? {
      source: s.source,
      campaign: s.campaign,
      visits: 0,
      visitors: 0,
      signups: 0,
      paid: 0,
      revenue: 0,
    };
    row.signups = s.signups;
    row.paid = s.paid;
    row.revenue = s.revenue;
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.paid - a.paid || b.signups - a.signups || b.visitors - a.visitors,
  );
}

// ---------------------------------------------------------------- pixel

const SETTINGS_ID = "default";

export async function getMetaPixelId(executor: Executor = db) {
  const row = await executor.query.marketingSettings.findFirst({
    where: eq(marketingSettings.id, SETTINGS_ID),
  });
  return row?.metaPixelId ?? null;
}

// The pixel id shown in Meta's Events Manager: digits only. Empty removes
// the pixel from the site.
export async function updateMetaPixelId(adminUserId: string, input: string) {
  const value = input.replace(/\s/g, "");
  if (value && !/^\d{10,20}$/.test(value)) {
    throw new Error(
      "Identifiant invalide : c'est le numéro du pixel (uniquement des chiffres) affiché dans le Gestionnaire d'événements de Meta.",
    );
  }
  await db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier le pixel.");
    }
    await tx
      .insert(marketingSettings)
      .values({
        id: SETTINGS_ID,
        metaPixelId: value || null,
        updatedBy: adminUserId,
      })
      .onConflictDoUpdate({
        target: marketingSettings.id,
        set: {
          metaPixelId: value || null,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "META_PIXEL_UPDATED",
      targetType: "marketing_settings",
      targetId: SETTINGS_ID,
      metadata: { metaPixelId: value || null },
    });
  });
}
