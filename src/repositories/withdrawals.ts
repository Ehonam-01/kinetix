import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import { withdrawalRequests } from "@/db/schema/withdrawals";

export function findWithdrawalRequestById(executor: Executor, id: string) {
  return executor.query.withdrawalRequests.findFirst({
    where: eq(withdrawalRequests.id, id),
  });
}

export function listWithdrawalRequestsForUser(
  executor: Executor,
  userId: string,
  limit = 50,
) {
  return executor.query.withdrawalRequests.findMany({
    where: eq(withdrawalRequests.userId, userId),
    orderBy: desc(withdrawalRequests.createdAt),
    limit,
  });
}

export type AdminWithdrawalRequest = {
  id: string;
  userId: string;
  username: string;
  amount: number;
  payoutPhone: string;
  createdAt: Date;
  confirmedAt: Date | null;
};

// Admin review queue — oldest confirmed request first, so nothing gets
// buried behind newer ones. Same join-then-select shape as
// repositories/sales.ts's listSalesForAdmin.
export function listPendingWithdrawalRequestsForAdmin(
  executor: Executor,
): Promise<AdminWithdrawalRequest[]> {
  return executor
    .select({
      id: withdrawalRequests.id,
      userId: withdrawalRequests.userId,
      username: profiles.username,
      amount: withdrawalRequests.amount,
      payoutPhone: withdrawalRequests.payoutPhone,
      createdAt: withdrawalRequests.createdAt,
      confirmedAt: withdrawalRequests.confirmedAt,
    })
    .from(withdrawalRequests)
    .innerJoin(profiles, eq(profiles.id, withdrawalRequests.userId))
    .where(eq(withdrawalRequests.status, "PENDING_REVIEW"))
    .orderBy(asc(withdrawalRequests.confirmedAt));
}
