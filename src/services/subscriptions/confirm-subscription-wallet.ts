import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriptionWalletRequests } from "@/db/schema/subscription-wallet-requests";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { payments } from "@/db/schema/payments";
import { userBalances } from "@/db/schema/user-balances";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "@/services/wallet/otp";
import { confirmSubscriptionPurchase } from "./confirm-subscription-payment";

// The subscription's pendant of confirm-course-purchase-wallet.ts (retired
// by this pivot). Mirrors services/wallet/confirm-transfer.ts's two-phase
// shape: the OTP is validated outside any transaction (so a wrong code's
// attempt-count penalty survives even though the call throws), then a
// single atomic transaction debits the wallet behind a WHERE-guarded UPDATE
// and hands off to confirmSubscriptionPurchase — the exact same function
// the Mobile Money webhook calls — for the subscription row, commission,
// and BV propagation, so that logic never has to exist twice.
//
// callerUserId must be either the buyer or the wallet owner — knowing a
// request id isn't enough on its own, the same defense-in-depth
// confirmTransfer applies via transfer.senderId !== senderId.
export async function confirmSubscriptionWithWallet(
  callerUserId: string,
  requestId: string,
  code: string,
) {
  const request = await db.query.subscriptionWalletRequests.findFirst({
    where: eq(subscriptionWalletRequests.id, requestId),
  });
  if (
    !request ||
    (request.buyerUserId !== callerUserId &&
      request.walletUserId !== callerUserId)
  ) {
    throw new Error("Demande de souscription introuvable.");
  }
  if (request.status !== "PENDING_OTP") {
    throw new Error("Cette demande a déjà été traitée ou a expiré.");
  }
  if (request.otpExpiresAt.getTime() < Date.now()) {
    await db
      .update(subscriptionWalletRequests)
      .set({ status: "EXPIRED" })
      .where(eq(subscriptionWalletRequests.id, request.id));
    throw new Error("Le code a expiré, veuillez recommencer la souscription.");
  }
  if (request.otpAttempts >= MAX_OTP_ATTEMPTS) {
    await db
      .update(subscriptionWalletRequests)
      .set({ status: "EXPIRED" })
      .where(eq(subscriptionWalletRequests.id, request.id));
    throw new Error(
      "Trop de tentatives, veuillez recommencer la souscription.",
    );
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
    await db
      .update(subscriptionWalletRequests)
      .set({
        otpAttempts: sql`${subscriptionWalletRequests.otpAttempts} + 1`,
      })
      .where(eq(subscriptionWalletRequests.id, request.id));
    throw new Error("Code incorrect.");
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .update(subscriptionWalletRequests)
      .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
      .where(
        and(
          eq(subscriptionWalletRequests.id, request.id),
          eq(subscriptionWalletRequests.status, "PENDING_OTP"),
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
        purpose: "SUBSCRIPTION",
        method: "WALLET",
        amount: request.amount,
        idempotencyKey: `SUBSCRIPTION_WALLET:${request.id}`,
        metadata: {
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
      metadata: { beneficiaryUserId: request.buyerUserId },
    });

    await tx
      .update(subscriptionWalletRequests)
      .set({ paymentId: payment.id })
      .where(eq(subscriptionWalletRequests.id, request.id));

    return confirmSubscriptionPurchase(tx, payment.id);
  });
}
