import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { coursePurchaseWalletRequests } from "@/db/schema/course-purchase-wallet-requests";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { payments } from "@/db/schema/payments";
import { userBalances } from "@/db/schema/user-balances";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "@/services/wallet/otp";
import { confirmCoursePurchase } from "./confirm-course-purchase";

// Mirrors services/wallet/confirm-transfer.ts's two-phase shape: the OTP is
// validated outside any transaction (so a wrong code's attempt-count
// penalty survives even though the call throws), then a single atomic
// transaction debits the wallet behind a WHERE-guarded UPDATE and hands off
// to the real confirmCoursePurchase — the exact same function the Mobile
// Money webhook calls — for the sale row, commission, and BV propagation,
// so that logic never has to exist twice.
//
// callerUserId must be either the buyer or the wallet owner — knowing a
// request id isn't enough on its own, the same defense-in-depth
// confirmTransfer applies via transfer.senderId !== senderId.
export async function confirmCoursePurchaseWithWallet(
  callerUserId: string,
  requestId: string,
  code: string,
) {
  const request = await db.query.coursePurchaseWalletRequests.findFirst({
    where: eq(coursePurchaseWalletRequests.id, requestId),
  });
  if (
    !request ||
    (request.buyerUserId !== callerUserId &&
      request.walletUserId !== callerUserId)
  ) {
    throw new Error("Demande d'achat introuvable.");
  }
  if (request.status !== "PENDING_OTP") {
    throw new Error("Cette demande a déjà été traitée ou a expiré.");
  }
  if (request.otpExpiresAt.getTime() < Date.now()) {
    await db
      .update(coursePurchaseWalletRequests)
      .set({ status: "EXPIRED" })
      .where(eq(coursePurchaseWalletRequests.id, request.id));
    throw new Error("Le code a expiré, veuillez recommencer l'achat.");
  }
  if (request.otpAttempts >= MAX_OTP_ATTEMPTS) {
    await db
      .update(coursePurchaseWalletRequests)
      .set({ status: "EXPIRED" })
      .where(eq(coursePurchaseWalletRequests.id, request.id));
    throw new Error("Trop de tentatives, veuillez recommencer l'achat.");
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
    await db
      .update(coursePurchaseWalletRequests)
      .set({
        otpAttempts: sql`${coursePurchaseWalletRequests.otpAttempts} + 1`,
      })
      .where(eq(coursePurchaseWalletRequests.id, request.id));
    throw new Error("Code incorrect.");
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .update(coursePurchaseWalletRequests)
      .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
      .where(
        and(
          eq(coursePurchaseWalletRequests.id, request.id),
          eq(coursePurchaseWalletRequests.status, "PENDING_OTP"),
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
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(userBalances.userId, request.walletUserId),
          sql`${userBalances.availableBalance} >= ${request.amount}`,
        ),
      )
      .returning();
    if (!debited) {
      throw new Error(
        "Solde disponible insuffisant au moment de la confirmation.",
      );
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        beneficiaryUserId: request.buyerUserId,
        payerUserId: request.walletUserId,
        purpose: "COURSE_PURCHASE",
        method: "WALLET",
        amount: request.amount,
        idempotencyKey: `COURSE_PURCHASE_WALLET:${request.id}`,
        metadata: {
          courseId: request.courseId,
          ambassadorUserId: request.ambassadorUserId,
          attributionId: request.attributionId,
        },
      })
      .returning();

    await tx.insert(financialTransactions).values({
      userId: request.walletUserId,
      type: "PAYMENT",
      amount: -request.amount,
      reference: payment.id,
      metadata: {
        beneficiaryUserId: request.buyerUserId,
        courseId: request.courseId,
      },
    });

    await tx
      .update(coursePurchaseWalletRequests)
      .set({ paymentId: payment.id })
      .where(eq(coursePurchaseWalletRequests.id, request.id));

    return confirmCoursePurchase(tx, payment.id);
  });
}
