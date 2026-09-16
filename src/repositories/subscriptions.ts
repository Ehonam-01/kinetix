import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import { subscriptions } from "@/db/schema/subscriptions";

export type SubscriptionStatus = {
  active: boolean;
  expiresAt: Date | null;
  pricePaid: number | null;
  // Ceil'd days remaining until expiresAt (negative once expired), or null
  // when there's no subscription at all. Computed here rather than in the
  // components that render it (dashboard/page.tsx,
  // components/subscription-alert-banner.tsx) — React's purity rules forbid
  // calling Date.now() during a component's render, so "now" has to be read
  // once, at data-fetch time, same as `active` itself already was.
  daysLeft: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The most recently-expiring subscription row for a user tells the whole
// story: expiresAt strictly grows with every renewal (see
// services/subscriptions/confirm-subscription-payment.ts), so it's always
// the one to check — no separate "current" flag needed. active is a pure
// function of the clock, never a stored status: this is what makes
// expiration cut access off immediately, with no grace period and no
// background job (explicit user decision).
export async function getSubscriptionStatus(
  executor: Executor,
  userId: string,
): Promise<SubscriptionStatus> {
  const latest = await executor.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    orderBy: desc(subscriptions.expiresAt),
  });
  if (!latest) {
    return { active: false, expiresAt: null, pricePaid: null, daysLeft: null };
  }
  const now = Date.now();
  return {
    active: latest.expiresAt.getTime() > now,
    expiresAt: latest.expiresAt,
    pricePaid: latest.pricePaid,
    daysLeft: Math.ceil((latest.expiresAt.getTime() - now) / DAY_MS),
  };
}

// Cheaper existence check for the access gate (repositories/courses.ts's
// hasCourseAccess) — a single indexed lookup instead of fetching the row.
export async function hasActiveSubscription(
  executor: Executor,
  userId: string,
): Promise<boolean> {
  const row = await executor.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      sql`${subscriptions.expiresAt} > now()`,
    ),
  });
  return !!row;
}

export type ReminderKind = "reminder7d" | "reminder1d";

const REMINDER_COLUMN = {
  reminder7d: subscriptions.reminder7dSentAt,
  reminder1d: subscriptions.reminder1dSentAt,
} as const;

export type ExpiringSubscriptionCandidate = {
  id: string;
  userId: string;
  expiresAt: Date;
};

// Raw candidates for one reminder kind: not yet reminded, expiring inside
// [start, end). Deliberately NOT yet "the subscriptions to actually email" —
// see filterCurrentSubscriptions below for why a second step is needed.
export async function findUnremindedSubscriptionsExpiringBetween(
  executor: Executor,
  kind: ReminderKind,
  start: Date,
  end: Date,
): Promise<ExpiringSubscriptionCandidate[]> {
  return executor
    .select({
      id: subscriptions.id,
      userId: subscriptions.userId,
      expiresAt: subscriptions.expiresAt,
    })
    .from(subscriptions)
    .where(
      and(
        isNull(REMINDER_COLUMN[kind]),
        gte(subscriptions.expiresAt, start),
        lte(subscriptions.expiresAt, end),
      ),
    );
}

// A user can have several subscription rows (renewal history) — the one
// that actually determines their access is whichever has the latest
// expiresAt (see getSubscriptionStatus above), which is NOT necessarily one
// of the date-windowed candidates above: an old row can still sit inside
// the "expiring in 7 days" window even after the user already renewed,
// since renewing inserts a new row rather than updating the old one in
// place. This map is the ground truth to filter candidates against.
export async function getLatestExpiryByUserId(
  executor: Executor,
  userIds: string[],
): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();
  const rows = await executor
    .select({
      userId: subscriptions.userId,
      maxExpiresAt: sql<Date>`max(${subscriptions.expiresAt})`,
    })
    .from(subscriptions)
    .where(inArray(subscriptions.userId, userIds))
    .groupBy(subscriptions.userId);
  return new Map(rows.map((r) => [r.userId, new Date(r.maxExpiresAt)]));
}

// Pure — unit-testable without a database. Keeps only the candidates that
// are genuinely their user's current subscription period, dropping a stale
// row that happens to still fall in the reminder window after a renewal.
export function filterCurrentSubscriptions<
  T extends { userId: string; expiresAt: Date },
>(candidates: T[], latestExpiryByUserId: Map<string, Date>): T[] {
  return candidates.filter(
    (c) =>
      latestExpiryByUserId.get(c.userId)?.getTime() === c.expiresAt.getTime(),
  );
}

export async function markReminderSent(
  executor: Executor,
  subscriptionId: string,
  kind: ReminderKind,
): Promise<void> {
  await executor
    .update(subscriptions)
    .set(
      kind === "reminder7d"
        ? { reminder7dSentAt: sql`now()` }
        : { reminder1dSentAt: sql`now()` },
    )
    .where(eq(subscriptions.id, subscriptionId));
}

export type AdminSubscriptionSummary = {
  id: string;
  buyerUsername: string;
  ambassadorUsername: string | null;
  pricePaid: number;
  businessVolume: number;
  startedAt: Date;
  expiresAt: Date;
  active: boolean;
  createdAt: Date;
};

// Admin listing (admin/subscriptions/page.tsx) — every subscription period
// ever sold, most recent first, mirroring listSalesForAdmin's shape.
export async function listSubscriptionsForAdmin(
  executor: Executor,
): Promise<AdminSubscriptionSummary[]> {
  const rows = await executor
    .select({
      id: subscriptions.id,
      buyerUsername: profiles.username,
      pricePaid: subscriptions.pricePaid,
      businessVolume: subscriptions.businessVolume,
      startedAt: subscriptions.startedAt,
      expiresAt: subscriptions.expiresAt,
      createdAt: subscriptions.createdAt,
      ambassadorUserId: subscriptions.ambassadorUserId,
    })
    .from(subscriptions)
    .innerJoin(profiles, eq(profiles.id, subscriptions.userId))
    .orderBy(desc(subscriptions.createdAt));

  const ambassadorIds = [
    ...new Set(
      rows
        .map((r) => r.ambassadorUserId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const ambassadors = ambassadorIds.length
    ? await executor.query.profiles.findMany({
        where: (p, { inArray }) => inArray(p.id, ambassadorIds),
      })
    : [];
  const usernameByAmbassadorId = new Map(
    ambassadors.map((a) => [a.id, a.username]),
  );

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    buyerUsername: r.buyerUsername,
    ambassadorUsername: r.ambassadorUserId
      ? (usernameByAmbassadorId.get(r.ambassadorUserId) ?? null)
      : null,
    pricePaid: r.pricePaid,
    businessVolume: r.businessVolume,
    startedAt: r.startedAt,
    expiresAt: r.expiresAt,
    active: r.expiresAt.getTime() > now,
    createdAt: r.createdAt,
  }));
}

export type AmbassadorSubscriptionSummary = {
  id: string;
  buyerUsername: string;
  businessVolume: number;
  createdAt: Date;
};

// "Souscriptions apportées" — the subscription pendant of
// listSalesForAmbassador, used by the dashboard overview's ambassador view.
export async function listSubscriptionsForAmbassador(
  executor: Executor,
  ambassadorUserId: string,
): Promise<AmbassadorSubscriptionSummary[]> {
  const rows = await executor
    .select({
      id: subscriptions.id,
      buyerUsername: profiles.username,
      businessVolume: subscriptions.businessVolume,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .innerJoin(profiles, eq(profiles.id, subscriptions.userId))
    .where(eq(subscriptions.ambassadorUserId, ambassadorUserId))
    .orderBy(desc(subscriptions.createdAt));

  return rows;
}
