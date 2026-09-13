import "server-only";
import { sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { userBalances } from "@/db/schema/user-balances";

// Shared by commission.ts and reward.ts (CASH-type rewards) — the only
// place that writes to user_balances, so the insert-or-increment logic
// can't drift between the two callers.
export async function creditBalance(
  tx: Executor,
  userId: string,
  amount: number,
) {
  await tx
    .insert(userBalances)
    .values({ userId, availableBalance: amount, lifetimeEarnings: amount })
    .onConflictDoUpdate({
      target: userBalances.userId,
      set: {
        availableBalance: sql`${userBalances.availableBalance} + ${amount}`,
        lifetimeEarnings: sql`${userBalances.lifetimeEarnings} + ${amount}`,
        updatedAt: sql`now()`,
      },
    });
}
