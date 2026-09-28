import "server-only";
import { and, desc, eq, gt, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import { subscriptionWalletRequests } from "@/db/schema/subscription-wallet-requests";
import { subscriptions } from "@/db/schema/subscriptions";

// Explicit product decision: once a subscription expires, the member keeps
// full access for this many days (with an alert banner) and can still
// renew on their own. Past it, the account is deactivated — no action at
// all on the platform, no self-service payment either — until an admin
// grants a new subscription (services/subscriptions/grant-subscription-credit.ts).
export const GRACE_PERIOD_DAYS = 7;

export type SubscriptionStatus = {
  // Inside the paid period (expiresAt still in the future).
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
  // Expired, but still within GRACE_PERIOD_DAYS: full access continues and
  // the member can renew on their own.
  inGracePeriod: boolean;
  // When the grace period ends (expiresAt + GRACE_PERIOD_DAYS) and the
  // ceil'd days left until then — only meaningful while inGracePeriod.
  graceEndsAt: Date | null;
  graceDaysLeft: number | null;
  // Past the grace period with no renewal: the account is deactivated
  // (dashboard/layout.tsx's blocked screen, requireActiveMember in every
  // member action) and only an admin can lift it. A brand new member who
  // never subscribed is NOT frozen (expiresAt is null for them) — only a
  // lapsed *renewal* deactivates an account, never a first-timer who hasn't
  // started yet (they're gated by profiles.status = PENDING_PAYMENT instead).
  frozen: boolean;
  // Kept for the blocked screen and the admin page: under the grace-period
  // rule a frozen account can only ever be reactivated by an admin, so this
  // always equals `frozen`. Deliberately never explained to the member
  // (explicit user decision: "pas une information publique").
  permanentlyFrozen: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function graceEndsAtFor(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
}

// The most recently-expiring subscription row for a user tells the whole
// story: expiresAt strictly grows with every renewal (see
// services/subscriptions/confirm-subscription-payment.ts), so it's always
// the one to check — no separate "current" flag needed. Every flag is a
// pure function of the clock, never a stored status: expiry, the grace
// period and deactivation all take effect with no background job.
export async function getSubscriptionStatus(
  executor: Executor,
  userId: string,
): Promise<SubscriptionStatus> {
  const latest = await executor.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    orderBy: desc(subscriptions.expiresAt),
  });
  if (!latest) {
    return {
      active: false,
      expiresAt: null,
      pricePaid: null,
      daysLeft: null,
      inGracePeriod: false,
      graceEndsAt: null,
      graceDaysLeft: null,
      frozen: false,
      permanentlyFrozen: false,
    };
  }
  const now = Date.now();
  const active = latest.expiresAt.getTime() > now;
  const graceEndsAt = graceEndsAtFor(latest.expiresAt);
  const inGracePeriod = !active && graceEndsAt.getTime() > now;
  const frozen = !active && !inGracePeriod;
  return {
    active,
    expiresAt: latest.expiresAt,
    pricePaid: latest.pricePaid,
    daysLeft: Math.ceil((latest.expiresAt.getTime() - now) / DAY_MS),
    inGracePeriod,
    graceEndsAt,
    graceDaysLeft: inGracePeriod
      ? Math.ceil((graceEndsAt.getTime() - now) / DAY_MS)
      : null,
    frozen,
    permanentlyFrozen: frozen,
  };
}

// Cheaper existence check for the access gate (repositories/courses.ts's
// hasCourseAccess) — a single indexed lookup instead of fetching the row.
// True during the paid period AND the grace period after it: access only
// stops once the account is deactivated (GRACE_PERIOD_DAYS past expiry).
export async function hasActiveSubscription(
  executor: Executor,
  userId: string,
): Promise<boolean> {
  const row = await executor.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      sql`${subscriptions.expiresAt} > now() - make_interval(days => ${GRACE_PERIOD_DAYS})`,
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

// "Souscriptions apportées" — used by the dashboard overview and the
// commissions page's ambassador view (the retired listSalesForAmbassador's
// replacement, now that subscriptions are the only paid product).
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

export type PendingWalletPaymentRequest = {
  id: string;
  buyerUsername: string;
  buyerFullName: string;
  amount: number;
  otpExpiresAt: Date;
};

// Subscription payments other members asked to charge to this wallet,
// still awaiting the owner's own confirmation (dashboard/transfer) — only
// the wallet owner can enter the code, see confirm-subscription-wallet.ts.
// Excludes the owner's own self-payments, which are confirmed from the
// subscription form itself.
export function listPendingWalletPaymentRequestsForOwner(
  executor: Executor,
  walletUserId: string,
): Promise<PendingWalletPaymentRequest[]> {
  return executor
    .select({
      id: subscriptionWalletRequests.id,
      buyerUsername: profiles.username,
      buyerFullName: profiles.fullName,
      amount: subscriptionWalletRequests.amount,
      otpExpiresAt: subscriptionWalletRequests.otpExpiresAt,
    })
    .from(subscriptionWalletRequests)
    .innerJoin(profiles, eq(profiles.id, subscriptionWalletRequests.buyerUserId))
    .where(
      and(
        eq(subscriptionWalletRequests.walletUserId, walletUserId),
        ne(subscriptionWalletRequests.buyerUserId, walletUserId),
        eq(subscriptionWalletRequests.status, "PENDING_OTP"),
        gt(subscriptionWalletRequests.otpExpiresAt, sql`now()`),
      ),
    )
    .orderBy(desc(subscriptionWalletRequests.createdAt));
}
