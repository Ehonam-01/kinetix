import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { profiles } from "@/db/schema/profiles";
import { userBalances } from "@/db/schema/user-balances";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { logAdminAction } from "./audit-log";

// Admin-only. Called once the mobile money payout has actually been sent
// manually (no live Moneroo payout integration — see
// services/wallet/confirm-withdrawal.ts). Moves the amount from
// pending_balance to withdrawn_balance and flips the linked ledger row
// PENDING -> COMPLETED; never touches available_balance, which was already
// debited at confirmWithdrawal time.
export async function approveWithdrawal(
  adminUserId: string,
  requestId: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut valider un retrait.");
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
        status: "PAID",
        reviewedBy: adminUserId,
        reviewedAt: sql`now()`,
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

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WITHDRAWAL_APPROVED",
      targetType: "withdrawal_request",
      targetId: requestId,
      metadata: { userId: request.userId, amount: request.amount },
    });

    return updated;
  });
}
