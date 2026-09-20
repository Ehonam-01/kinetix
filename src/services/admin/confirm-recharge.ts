import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminRechargeRequests } from "@/db/schema/admin-recharge-requests";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { creditBalance } from "@/services/mlm/credit-balance";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "@/services/wallet/otp";
import { logAdminAction } from "./audit-log";

// Two phases, deliberately not one single wrapping transaction — same
// reasoning as confirmTransfer (services/wallet/confirm-transfer.ts): a
// wrong code's attempt-count penalty must persist even though the call
// throws, which a rollback inside the same transaction would undo.
export async function confirmAdminRecharge(
  adminUserId: string,
  requestId: string,
  code: string,
) {
  const request = await db.query.adminRechargeRequests.findFirst({
    where: eq(adminRechargeRequests.id, requestId),
  });
  if (!request || request.requestedByAdminId !== adminUserId) {
    throw new Error("Demande de recharge introuvable.");
  }
  if (request.status !== "PENDING_OTP") {
    throw new Error("Cette demande a déjà été traitée ou a expiré.");
  }
  if (request.otpExpiresAt.getTime() < Date.now()) {
    await db
      .update(adminRechargeRequests)
      .set({ status: "EXPIRED" })
      .where(eq(adminRechargeRequests.id, request.id));
    throw new Error("Le code a expiré, veuillez recommencer.");
  }
  if (request.otpAttempts >= MAX_OTP_ATTEMPTS) {
    await db
      .update(adminRechargeRequests)
      .set({ status: "EXPIRED" })
      .where(eq(adminRechargeRequests.id, request.id));
    throw new Error("Trop de tentatives, veuillez recommencer.");
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
    await db
      .update(adminRechargeRequests)
      .set({ otpAttempts: sql`${adminRechargeRequests.otpAttempts} + 1` })
      .where(eq(adminRechargeRequests.id, request.id));
    throw new Error("Code incorrect.");
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .update(adminRechargeRequests)
      .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
      .where(
        and(
          eq(adminRechargeRequests.id, request.id),
          eq(adminRechargeRequests.status, "PENDING_OTP"),
        ),
      )
      .returning();
    if (!locked) {
      throw new Error("Cette demande a déjà été traitée.");
    }

    const [ledgerTx] = await tx
      .insert(financialTransactions)
      .values({
        userId: request.beneficiaryUserId,
        type: "ADJUSTMENT",
        amount: request.amount,
        reference: `ADMIN_RECHARGE:${request.id}`,
        metadata: { grantedByAdminId: adminUserId, reason: request.reason },
      })
      .returning();

    await creditBalance(tx, request.beneficiaryUserId, request.amount);

    await tx
      .update(adminRechargeRequests)
      .set({ financialTransactionId: ledgerTx.id })
      .where(eq(adminRechargeRequests.id, request.id));

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "BALANCE_CREDITED",
      targetType: "profile",
      targetId: request.beneficiaryUserId,
      metadata: { amount: request.amount, reason: request.reason },
    });

    return locked;
  });
}
