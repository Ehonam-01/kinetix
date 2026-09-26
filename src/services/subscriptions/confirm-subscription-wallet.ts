import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
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
// Only the WALLET OWNER can ever enter the code — the person whose balance
// is at stake authorizes it from their own session. When someone pays with
// their own wallet, buyer and owner are the same person, so that case is
// unchanged. When the wallet is someone else's, the buyer used to be able
// to type the code too, which let any member target any other member's
// wallet from their own account: brute-force the code, or talk the owner
// into reading it out (security audit H3). The owner now confirms from
// dashboard/transfer instead.
export async function confirmSubscriptionWithWallet(
  callerUserId: string,
  requestId: string,
  code: string,
) {
  // Attempt consumed atomically before comparing the code — see
  // confirmTransfer (security audit H2).
  const [request] = await db
    .update(subscriptionWalletRequests)
    .set({
      otpAttempts: sql`${subscriptionWalletRequests.otpAttempts} + 1`,
    })
    .where(
      and(
        eq(subscriptionWalletRequests.id, requestId),
        eq(subscriptionWalletRequests.walletUserId, callerUserId),
        eq(subscriptionWalletRequests.status, "PENDING_OTP"),
        lt(subscriptionWalletRequests.otpAttempts, MAX_OTP_ATTEMPTS),
        gt(subscriptionWalletRequests.otpExpiresAt, sql`now()`),
      ),
    )
    .returning();

  if (!request) {
    const existing = await db.query.subscriptionWalletRequests.findFirst({
      where: eq(subscriptionWalletRequests.id, requestId),
    });
    if (!existing || existing.walletUserId !== callerUserId) {
      throw new Error("Demande de souscription introuvable.");
    }
    if (existing.status !== "PENDING_OTP") {
      throw new Error("Cette demande a déjà été traitée ou a expiré.");
    }
    await db
      .update(subscriptionWalletRequests)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(subscriptionWalletRequests.id, existing.id),
          eq(subscriptionWalletRequests.status, "PENDING_OTP"),
        ),
      );
    throw new Error(
      existing.otpAttempts >= MAX_OTP_ATTEMPTS
        ? "Trop de tentatives, veuillez recommencer la souscription."
        : "Le code a expiré, veuillez recommencer la souscription.",
    );
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
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
