import "server-only";
import { and, gte, inArray, ne, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { subscriptions } from "@/db/schema/subscriptions";

function startOfMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// The only "earning" transaction types (mirrors the enum in
// db/schema/financial-transactions.ts) — excludes PAYMENT/REFUND/
// WITHDRAWAL/ADJUSTMENT/TRANSFER_*/REWARD, which aren't commissions.
// COMMISSION_REVERSAL is included deliberately: it's a negative offsetting
// row for a reversed commission (see getDirectSaleCommissionTotal), so
// summing it alongside the rest nets a refunded sale's commission back out
// instead of overstating what was actually paid.
const COMMISSION_TYPES = [
  "DIRECT_COMMISSION",
  "LEVEL_1_BONUS",
  "LEVEL_COMMISSION",
  "DIRECT_SALE_COMMISSION",
  "GENERATION_COMMISSION",
  "COMMISSION_REVERSAL",
] as const;

export type AdminOverviewStats = {
  totalRevenue: number;
  revenueThisMonth: number;
  totalCommissionsPaid: number;
  newSubscriptionsThisMonth: number;
};

// Chiffre d'affaires (admin/page.tsx) — subscriptions.pricePaid is the real
// amount actually paid at the time (never assumed equal to today's
// subscription.price_in_cfa parameter, which can change), summed across
// every period ever sold: initial subscriptions and renewals both count as
// real revenue. totalCommissionsPaid is the platform's other side of that
// ledger — what it actually cost to pay ambassadors for it.
export async function getAdminOverviewStats(
  executor: Executor,
): Promise<AdminOverviewStats> {
  const monthStart = startOfMonthUtc();

  const [revenueRow, monthRevenueRow, commissionRow, monthSubsRow] =
    await Promise.all([
      executor
        .select({ total: sql<string>`coalesce(sum(${subscriptions.pricePaid}), 0)` })
        .from(subscriptions),
      executor
        .select({ total: sql<string>`coalesce(sum(${subscriptions.pricePaid}), 0)` })
        .from(subscriptions)
        .where(gte(subscriptions.createdAt, monthStart)),
      executor
        .select({
          total: sql<string>`coalesce(sum(${financialTransactions.amount}), 0)`,
        })
        .from(financialTransactions)
        .where(
          and(
            inArray(financialTransactions.type, COMMISSION_TYPES),
            ne(financialTransactions.status, "REVERSED"),
          ),
        ),
      executor
        .select({ count: sql<string>`count(*)` })
        .from(subscriptions)
        .where(gte(subscriptions.createdAt, monthStart)),
    ]);

  return {
    totalRevenue: Number(revenueRow[0]?.total ?? 0),
    revenueThisMonth: Number(monthRevenueRow[0]?.total ?? 0),
    totalCommissionsPaid: Number(commissionRow[0]?.total ?? 0),
    newSubscriptionsThisMonth: Number(monthSubsRow[0]?.count ?? 0),
  };
}

export type RevenuePoint = { date: string; cumulativeRevenue: number };

// One point per day for the trailing `days` window, each the cumulative
// platform-wide revenue as of the end of that day — same carry-forward
// shape as getBalanceHistory (financial-transactions.ts), just scoped to
// every subscription ever sold instead of one user's ledger, so a day with
// no sale still draws a flat (not gapped) line.
export async function getRevenueHistory(
  executor: Executor,
  days = 30,
): Promise<RevenuePoint[]> {
  const rows = await executor
    .select({
      createdAt: subscriptions.createdAt,
      pricePaid: subscriptions.pricePaid,
    })
    .from(subscriptions)
    .orderBy(subscriptions.createdAt);

  let running = 0;
  const revenueAtEndOfDay = new Map<string, number>();
  for (const row of rows) {
    running += row.pricePaid;
    revenueAtEndOfDay.set(row.createdAt.toISOString().slice(0, 10), running);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - (days - 1));

  let carry = 0;
  for (const [day, revenue] of revenueAtEndOfDay) {
    if (new Date(`${day}T00:00:00.000Z`) < windowStart) carry = revenue;
  }

  const points: RevenuePoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(windowStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    if (revenueAtEndOfDay.has(key)) carry = revenueAtEndOfDay.get(key)!;
    points.push({ date: key, cumulativeRevenue: carry });
  }

  return points;
}
