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

// Matches an incoming Bictorys payout webhook (event.providerReference)
// back to the request that triggered it (services/payments/
// handle-payout-webhook.ts) — the payout counterpart of
// repositories/payments.ts's findPaymentByProviderReference.
export function findWithdrawalRequestByPayoutReference(
  executor: Executor,
  payoutProviderReference: string,
) {
  return executor.query.withdrawalRequests.findFirst({
    where: eq(
      withdrawalRequests.payoutProviderReference,
      payoutProviderReference,
    ),
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
  fullName: string;
  amount: number;
  payoutPhone: string;
  operator: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
  payoutFailureReason: string | null;
};

const ADMIN_WITHDRAWAL_REQUEST_COLUMNS = {
  id: withdrawalRequests.id,
  userId: withdrawalRequests.userId,
  username: profiles.username,
  fullName: profiles.fullName,
  amount: withdrawalRequests.amount,
  payoutPhone: withdrawalRequests.payoutPhone,
  operator: withdrawalRequests.operator,
  createdAt: withdrawalRequests.createdAt,
  confirmedAt: withdrawalRequests.confirmedAt,
  payoutFailureReason: withdrawalRequests.payoutFailureReason,
};

// Admin review queue — oldest confirmed request first, so nothing gets
// buried behind newer ones. Same join-then-select shape as
// repositories/sales.ts's listSalesForAdmin.
export function listPendingWithdrawalRequestsForAdmin(
  executor: Executor,
): Promise<AdminWithdrawalRequest[]> {
  return executor
    .select(ADMIN_WITHDRAWAL_REQUEST_COLUMNS)
    .from(withdrawalRequests)
    .innerJoin(profiles, eq(profiles.id, withdrawalRequests.userId))
    .where(eq(withdrawalRequests.status, "PENDING_REVIEW"))
    .orderBy(asc(withdrawalRequests.confirmedAt));
}

// Requests whose Bictorys payout call has been accepted but not yet
// webhook-confirmed — informational for the admin (nothing to click), a
// stuck row here past a few minutes is the signal something needs
// investigating.
export function listProcessingWithdrawalRequestsForAdmin(
  executor: Executor,
): Promise<AdminWithdrawalRequest[]> {
  return executor
    .select(ADMIN_WITHDRAWAL_REQUEST_COLUMNS)
    .from(withdrawalRequests)
    .innerJoin(profiles, eq(profiles.id, withdrawalRequests.userId))
    .where(eq(withdrawalRequests.status, "PROCESSING"))
    .orderBy(asc(withdrawalRequests.confirmedAt));
}
