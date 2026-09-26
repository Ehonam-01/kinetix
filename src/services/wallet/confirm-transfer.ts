import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { userBalances } from "@/db/schema/user-balances";
import { walletTransfers } from "@/db/schema/wallet-transfers";
import { creditBalance } from "@/services/mlm/credit-balance";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "./otp";

// Two phases, deliberately not one single wrapping transaction:
//
// 1. Validate the code against the still-PENDING_OTP row. A wrong code or
//    an expired/exhausted transfer needs its penalty (attempt++, or
//    EXPIRED) to actually persist — if this were inside the same
//    transaction as the money movement and we threw to report the
//    failure, Postgres would roll the attempt-tracking back too, and the
//    limit would never bite.
// 2. Only once the code is known-valid: an atomic transaction that flips
//    PENDING_OTP -> CONFIRMED behind a `WHERE status = 'PENDING_OTP'`
//    guard (so a concurrent double-submit can't both win), then debits the
//    sender behind a `WHERE available_balance >= amount` guard (closing
//    the TOCTOU gap a plain read-then-write would have — see
//    payments/wallet-payment.ts, which predates this pattern), and
//    credits the recipient via the shared creditBalance helper.
export async function confirmTransfer(
  senderId: string,
  transferId: string,
  code: string,
) {
  // The attempt is consumed atomically BEFORE the code is compared: a
  // read-check-then-increment let N concurrent requests all read the same
  // otp_attempts and each try a different code, so the 5-attempt cap only
  // held for sequential calls (security audit H2).
  const [transfer] = await db
    .update(walletTransfers)
    .set({ otpAttempts: sql`${walletTransfers.otpAttempts} + 1` })
    .where(
      and(
        eq(walletTransfers.id, transferId),
        eq(walletTransfers.senderId, senderId),
        eq(walletTransfers.status, "PENDING_OTP"),
        lt(walletTransfers.otpAttempts, MAX_OTP_ATTEMPTS),
        gt(walletTransfers.otpExpiresAt, sql`now()`),
      ),
    )
    .returning();

  if (!transfer) {
    const existing = await db.query.walletTransfers.findFirst({
      where: eq(walletTransfers.id, transferId),
    });
    if (!existing || existing.senderId !== senderId) {
      throw new Error("Transfert introuvable.");
    }
    if (existing.status !== "PENDING_OTP") {
      throw new Error("Ce transfert a déjà été traité ou a expiré.");
    }
    await db
      .update(walletTransfers)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(walletTransfers.id, existing.id),
          eq(walletTransfers.status, "PENDING_OTP"),
        ),
      );
    throw new Error(
      existing.otpAttempts >= MAX_OTP_ATTEMPTS
        ? "Trop de tentatives, veuillez demander un nouveau transfert."
        : "Le code a expiré, veuillez demander un nouveau transfert.",
    );
  }

  if (!verifyOtpCode(code, transfer.otpCodeHash)) {
    throw new Error("Code incorrect.");
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .update(walletTransfers)
      .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
      .where(
        and(
          eq(walletTransfers.id, transfer.id),
          eq(walletTransfers.status, "PENDING_OTP"),
        ),
      )
      .returning();
    if (!locked) {
      throw new Error("Ce transfert a déjà été traité.");
    }

    const [debited] = await tx
      .update(userBalances)
      .set({
        availableBalance: sql`${userBalances.availableBalance} - ${transfer.amount}`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(userBalances.userId, senderId),
          sql`${userBalances.availableBalance} >= ${transfer.amount}`,
        ),
      )
      .returning();
    if (!debited) {
      throw new Error(
        "Solde disponible insuffisant au moment de la confirmation.",
      );
    }

    const [senderTx] = await tx
      .insert(financialTransactions)
      .values({
        userId: senderId,
        type: "TRANSFER_SENT",
        amount: -transfer.amount,
        reference: `TRANSFER:${transfer.id}:OUT`,
        metadata: {
          transferId: transfer.id,
          recipientId: transfer.recipientId,
        },
      })
      .returning();

    await creditBalance(tx, transfer.recipientId, transfer.amount);

    const [recipientTx] = await tx
      .insert(financialTransactions)
      .values({
        userId: transfer.recipientId,
        type: "TRANSFER_RECEIVED",
        amount: transfer.amount,
        reference: `TRANSFER:${transfer.id}:IN`,
        metadata: { transferId: transfer.id, senderId },
      })
      .returning();

    await tx
      .update(walletTransfers)
      .set({
        senderTransactionId: senderTx.id,
        recipientTransactionId: recipientTx.id,
      })
      .where(eq(walletTransfers.id, transfer.id));

    return locked;
  });
}
