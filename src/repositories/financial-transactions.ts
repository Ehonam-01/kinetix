import "server-only";
import { and, asc, desc, eq, ne, or } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { commissionEvents } from "@/db/schema/commission-events";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { userBalances } from "@/db/schema/user-balances";

// No row yet means no financial activity at all — same "absence means
// zero/locked" convention as member_levels/member_rewards, not an error.
export async function getBalance(executor: Executor, userId: string) {
  const balance = await executor.query.userBalances.findFirst({
    where: eq(userBalances.userId, userId),
  });
  return (
    balance ?? {
      userId,
      availableBalance: 0,
      pendingBalance: 0,
      withdrawnBalance: 0,
      lifetimeEarnings: 0,
    }
  );
}

export function listTransactions(
  executor: Executor,
  userId: string,
  limit = 50,
) {
  return executor.query.financialTransactions.findMany({
    where: eq(financialTransactions.userId, userId),
    orderBy: desc(financialTransactions.createdAt),
    limit,
  });
}

export type BalanceHistoryPoint = { date: string; balance: number };

// One point per day for the trailing `days` window, each the cumulative
// running balance as of the end of that day — derived straight from the
// ledger (the only source of truth per FINANCIAL_MODEL.md), never from
// user_balances. A day with no transaction carries the previous day's
// balance forward, so the line is always continuous. Excludes REVERSED
// rows (a rejected withdrawal, see services/admin/reject-withdrawal.ts) —
// unlike a commission reversal, which is a new offsetting row, a rejected
// withdrawal's original row never represented money that actually left, so
// it's excluded rather than netted against a second row. A still-PENDING
// withdrawal (services/wallet/confirm-withdrawal.ts) does count: the funds
// are genuinely no longer available the moment it's confirmed, whether or
// not an admin has approved the payout yet.
export async function getBalanceHistory(
  executor: Executor,
  userId: string,
  days = 30,
): Promise<BalanceHistoryPoint[]> {
  const all = await executor.query.financialTransactions.findMany({
    where: and(
      eq(financialTransactions.userId, userId),
      ne(financialTransactions.status, "REVERSED"),
    ),
    orderBy: asc(financialTransactions.createdAt),
  });

  let running = 0;
  const balanceAtEndOfDay = new Map<string, number>();
  for (const tx of all) {
    running += tx.amount;
    balanceAtEndOfDay.set(tx.createdAt.toISOString().slice(0, 10), running);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - (days - 1));

  // Seed the carry-forward value with whatever the balance already was
  // just before the window opens (insertion order === ascending date,
  // since `all` was fetched oldest-first).
  let carry = 0;
  for (const [day, balance] of balanceAtEndOfDay) {
    if (new Date(`${day}T00:00:00.000Z`) < windowStart) carry = balance;
  }

  const points: BalanceHistoryPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(windowStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    if (balanceAtEndOfDay.has(key)) carry = balanceAtEndOfDay.get(key)!;
    points.push({ date: key, balance: carry });
  }

  return points;
}

// Net lifetime total from an ambassador's own attributed sales
// (DIRECT_SALE_COMMISSION), distinct from GENERATION_COMMISSION (the
// team/BV bonus) and from the retired pre-pivot DIRECT_COMMISSION type —
// see "commission directe" in MLM_RULES.md. A COMMISSION_REVERSAL row only
// counts here if it reversed a DIRECT_SALE event specifically (joined via
// commissionEventId), so a refunded personal sale correctly nets back out
// instead of overstating what was actually kept — same invariant getBalance
// relies on, just scoped to this one commission type.
export async function getDirectSaleCommissionTotal(
  executor: Executor,
  userId: string,
): Promise<number> {
  const rows = await executor
    .select({ amount: financialTransactions.amount })
    .from(financialTransactions)
    .leftJoin(
      commissionEvents,
      eq(financialTransactions.commissionEventId, commissionEvents.id),
    )
    .where(
      and(
        eq(financialTransactions.userId, userId),
        or(
          eq(financialTransactions.type, "DIRECT_SALE_COMMISSION"),
          and(
            eq(financialTransactions.type, "COMMISSION_REVERSAL"),
            eq(commissionEvents.type, "DIRECT_SALE"),
          ),
        ),
      ),
    );

  return rows.reduce((sum, r) => sum + r.amount, 0);
}
