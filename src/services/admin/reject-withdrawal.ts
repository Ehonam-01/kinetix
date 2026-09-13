import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { profiles } from "@/db/schema/profiles";
import { userBalances } from "@/db/schema/user-balances";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { logAdminAction } from "./audit-log";

// Admin-only. Returns the amount from pending_balance to available_balance
// and flips the linked ledger row PENDING -> REVERSED — never a new
// compensating row, since nothing left the platform for real yet.
// repositories/financial-transactions.ts's getBalanceHistory excludes
// REVERSED rows from its running sum, so a rejected request never shows as
// money that left.
export async function rejectWithdrawal(
  adminUserId: string,
  requestId: string,
  reason: string,
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Un motif de refus est requis.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut refuser un retrait.");
    }

    const request = await tx.query.withdrawalRequests.findFirst({
      where: eq(withdrawalRequests.id, requestId),
    });
    if (!request) {
      throw new Error("Demande de retrait introuvable.");
    }

    const [updated] = await tx
      .update(withdrawalRequests)
      .set({
        status: "REJECTED",
        reviewedBy: adminUserId,
        reviewedAt: sql`now()`,
        rejectionReason: trimmedReason,
      })
      .where(
        and(
          eq(withdrawalRequests.id, requestId),
          eq(withdrawalRequests.status, "PENDING_REVIEW"),
        ),
      )
      .returning();
    if (!updated) {
      throw new Error("Cette demande n'est plus en attente de validation.");
    }

    await tx
      .update(userBalances)
      .set({
        pendingBalance: sql`${userBalances.pendingBalance} - ${request.amount}`,
        availableBalance: sql`${userBalances.availableBalance} + ${request.amount}`,
        updatedAt: sql`now()`,
      })
      .where(eq(userBalances.userId, request.userId));

    if (request.financialTransactionId) {
      await tx
        .update(financialTransactions)
        .set({ status: "REVERSED" })
        .where(eq(financialTransactions.id, request.financialTransactionId));
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WITHDRAWAL_REJECTED",
      targetType: "withdrawal_request",
      targetId: requestId,
      metadata: {
        userId: request.userId,
        amount: request.amount,
        reason: trimmedReason,
      },
    });

    return updated;
  });
}
