import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { userBalances } from "@/db/schema/user-balances";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "./otp";
import { notifyWithdrawal } from "@/services/notifications/withdrawal-emails";

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
  // Attempt consumed atomically before comparing the code — see
  // confirmTransfer (security audit H2).
  const [request] = await db
    .update(withdrawalRequests)
    .set({ otpAttempts: sql`${withdrawalRequests.otpAttempts} + 1` })
    .where(
      and(
        eq(withdrawalRequests.id, requestId),
        eq(withdrawalRequests.userId, userId),
        eq(withdrawalRequests.status, "PENDING_OTP"),
        lt(withdrawalRequests.otpAttempts, MAX_OTP_ATTEMPTS),
        gt(withdrawalRequests.otpExpiresAt, sql`now()`),
      ),
    )
    .returning();

  if (!request) {
    const existing = await db.query.withdrawalRequests.findFirst({
      where: eq(withdrawalRequests.id, requestId),
    });
    if (!existing || existing.userId !== userId) {
      throw new Error("Demande de retrait introuvable.");
    }
    if (existing.status !== "PENDING_OTP") {
      throw new Error("Cette demande a déjà été traitée ou a expiré.");
    }
    await db
      .update(withdrawalRequests)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(withdrawalRequests.id, existing.id),
          eq(withdrawalRequests.status, "PENDING_OTP"),
        ),
      );
    throw new Error(
      existing.otpAttempts >= MAX_OTP_ATTEMPTS
        ? "Trop de tentatives, veuillez demander un nouveau retrait."
        : "Le code a expiré, veuillez demander un nouveau retrait.",
    );
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
    throw new Error("Code incorrect.");
  }

  const confirmed = await db.transaction(async (tx) => {
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

  // After the commit, never inside it — and it never throws.
  await notifyWithdrawal(confirmed.id, "RECEIVED");
  return confirmed;
}
