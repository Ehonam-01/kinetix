import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { userBalances } from "@/db/schema/user-balances";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { findWithdrawalRequestByPayoutReference } from "@/repositories/withdrawals";
import { logAdminAction } from "@/services/admin/audit-log";
import type { WebhookEvent } from "./provider";

// The payout counterpart of process-webhook-event.ts — called from the
// same app/api/webhooks/bictorys/route.ts once it determines a given event
// references a withdrawal_requests row (payout) rather than a payments row
// (charge). Unlike charges, there's no payment_events dedupe table here:
// the WHERE-guarded UPDATE (status = 'PROCESSING') already makes every
// transition idempotent — a replayed webhook simply finds no row to update
// and no-ops, same TOCTOU-safe pattern as approveWithdrawal/rejectWithdrawal.
export async function processPayoutWebhookEvent(
  tx: Executor,
  event: WebhookEvent,
) {
  const request = await findWithdrawalRequestByPayoutReference(
    tx,
    event.providerReference,
  );
  if (!request) {
    return { processed: false as const };
  }

  if (event.status === "CONFIRMED") {
    const [updated] = await tx
      .update(withdrawalRequests)
      .set({ status: "PAID" })
      .where(
        and(
          eq(withdrawalRequests.id, request.id),
          eq(withdrawalRequests.status, "PROCESSING"),
        ),
      )
      .returning();
    if (!updated) {
      return { processed: false as const };
    }

    await tx
      .update(userBalances)
      .set({
        pendingBalance: sql`${userBalances.pendingBalance} - ${request.amount}`,
        withdrawnBalance: sql`${userBalances.withdrawnBalance} + ${request.amount}`,
        updatedAt: sql`now()`,
      })
      .where(eq(userBalances.userId, request.userId));

    if (request.financialTransactionId) {
      await tx
        .update(financialTransactions)
        .set({ status: "COMPLETED" })
        .where(eq(financialTransactions.id, request.financialTransactionId));
    }

    if (request.reviewedBy) {
      await logAdminAction(tx, {
        actorUserId: request.reviewedBy,
        action: "WITHDRAWAL_PAYOUT_CONFIRMED",
        targetType: "withdrawal_request",
        targetId: request.id,
        metadata: { userId: request.userId, amount: request.amount },
      });
    }
  } else if (event.status === "FAILED") {
    const [updated] = await tx
      .update(withdrawalRequests)
      .set({
        status: "PENDING_REVIEW",
        payoutFailureReason: `Le virement Bictorys a échoué (référence ${event.providerReference}).`,
      })
      .where(
        and(
          eq(withdrawalRequests.id, request.id),
          eq(withdrawalRequests.status, "PROCESSING"),
        ),
      )
      .returning();
    if (!updated) {
      return { processed: false as const };
    }

    if (request.reviewedBy) {
      await logAdminAction(tx, {
        actorUserId: request.reviewedBy,
        action: "WITHDRAWAL_PAYOUT_FAILED",
        targetType: "withdrawal_request",
        targetId: request.id,
        metadata: { userId: request.userId, amount: request.amount },
      });
    }
  }

  return { processed: true as const };
}
