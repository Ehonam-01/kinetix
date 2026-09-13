import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { userBalances } from "@/db/schema/user-balances";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "./otp";

// Mirrors confirmTransfer (services/wallet/confirm-transfer.ts) — same
// two-phase shape (validate the OTP outside any transaction so a wrong
// code's attempt-count penalty survives even though the overall call
// throws; only the money movement itself is atomic) and the same
// WHERE-guarded UPDATE pattern to close every TOCTOU gap.
//
// Unlike a transfer, this does not credit anyone yet: the amount moves
// from available_balance to pending_balance and a PENDING financial_transactions
// row (WITHDRAWAL, negative amount) is created — the money doesn't actually
// leave the platform until an admin calls approveWithdrawal
// (services/admin/approve-withdrawal.ts), because no live Moneroo payout
// integration exists yet (env.moneroo.ts) and the mobile money transfer
// has to happen manually.
export async function confirmWithdrawal(
  userId: string,
  requestId: string,
  code: string,
) {
  const request = await db.query.withdrawalRequests.findFirst({
    where: eq(withdrawalRequests.id, requestId),
  });
  if (!request || request.userId !== userId) {
    throw new Error("Demande de retrait introuvable.");
  }
  if (request.status !== "PENDING_OTP") {
    throw new Error("Cette demande a déjà été traitée ou a expiré.");
  }
  if (request.otpExpiresAt.getTime() < Date.now()) {
    await db
      .update(withdrawalRequests)
      .set({ status: "EXPIRED" })
      .where(eq(withdrawalRequests.id, request.id));
    throw new Error("Le code a expiré, veuillez demander un nouveau retrait.");
  }
  if (request.otpAttempts >= MAX_OTP_ATTEMPTS) {
    await db
      .update(withdrawalRequests)
      .set({ status: "EXPIRED" })
      .where(eq(withdrawalRequests.id, request.id));
    throw new Error(
      "Trop de tentatives, veuillez demander un nouveau retrait.",
    );
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
    await db
      .update(withdrawalRequests)
      .set({ otpAttempts: sql`${withdrawalRequests.otpAttempts} + 1` })
      .where(eq(withdrawalRequests.id, request.id));
    throw new Error("Code incorrect.");
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .update(withdrawalRequests)
      .set({ status: "PENDING_REVIEW", confirmedAt: sql`now()` })
      .where(
        and(
          eq(withdrawalRequests.id, request.id),
          eq(withdrawalRequests.status, "PENDING_OTP"),
        ),
      )
      .returning();
    if (!locked) {
      throw new Error("Cette demande a déjà été traitée.");
    }

    const [debited] = await tx
      .update(userBalances)
      .set({
        availableBalance: sql`${userBalances.availableBalance} - ${request.amount}`,
        pendingBalance: sql`${userBalances.pendingBalance} + ${request.amount}`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(userBalances.userId, userId),
          sql`${userBalances.availableBalance} >= ${request.amount}`,
        ),
      )
      .returning();
    if (!debited) {
      throw new Error(
        "Solde disponible insuffisant au moment de la confirmation.",
      );
    }

    const [ledgerRow] = await tx
      .insert(financialTransactions)
      .values({
        userId,
        type: "WITHDRAWAL",
        amount: -request.amount,
        status: "PENDING",
        reference: `WITHDRAWAL:${request.id}`,
        metadata: { withdrawalRequestId: request.id },
      })
      .returning();

    const [updated] = await tx
      .update(withdrawalRequests)
      .set({ financialTransactionId: ledgerRow.id })
      .where(eq(withdrawalRequests.id, request.id))
      .returning();

    return updated;
  });
}
