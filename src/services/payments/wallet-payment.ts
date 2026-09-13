import "server-only";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { payments } from "@/db/schema/payments";
import { sponsorships } from "@/db/schema/sponsorships";
import { userBalances } from "@/db/schema/user-balances";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { activateRegistration } from "./activate-registration";

// A sponsor funds their own downline's registration from their available
// balance — never a stranger's, and never their own (that's the
// MOBILE_MONEY or ADMIN_CREDIT path).
export async function payRegistrationFromWallet(
  payerUserId: string,
  beneficiaryUserId: string,
) {
  return db.transaction(async (tx) => {
    const sponsorship = await tx.query.sponsorships.findFirst({
      where: eq(sponsorships.userId, beneficiaryUserId),
    });
    if (sponsorship?.sponsorId !== payerUserId) {
      throw new Error(
        "Vous ne pouvez financer que l'inscription d'un filleul que vous parrainez.",
      );
    }

    const amount = await getCurrentParameterValue(tx, "registration_price");

    const balance = await tx.query.userBalances.findFirst({
      where: eq(userBalances.userId, payerUserId),
    });
    if (!balance || balance.availableBalance < amount) {
      throw new Error(
        "Solde disponible insuffisant pour financer cette inscription.",
      );
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        beneficiaryUserId,
        payerUserId,
        purpose: "REGISTRATION",
        method: "WALLET",
        amount,
        status: "PENDING",
        idempotencyKey: `WALLET:${beneficiaryUserId}:${randomUUID()}`,
      })
      .returning();

    await tx
      .update(userBalances)
      .set({
        availableBalance: sql`${userBalances.availableBalance} - ${amount}`,
        updatedAt: sql`now()`,
      })
      .where(eq(userBalances.userId, payerUserId));

    await tx.insert(financialTransactions).values({
      userId: payerUserId,
      type: "PAYMENT",
      amount: -amount,
      reference: payment.id,
      metadata: { beneficiaryUserId },
    });

    return activateRegistration(tx, payment.id);
  });
}
