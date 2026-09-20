import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { profiles } from "@/db/schema/profiles";
import { creditBalance } from "@/services/mlm/credit-balance";
import { logAdminAction } from "./audit-log";

// A manual top-up, not tied to any product purchase — unlike
// grantAdminCredit/grantSubscriptionCredit (which pay for a specific
// registration/subscription via the payments table), this only ever
// touches the ledger, exactly like confirm-transfer.ts crediting a
// transfer's recipient. ADJUSTMENT is the ledger type financial-
// transactions.ts itself documents for manual/admin corrections.
export async function creditMemberBalance(
  adminUserId: string,
  beneficiaryUserId: string,
  amount: number,
  reason?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Le montant doit être un nombre entier positif.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut créditer un solde.");
    }

    await tx.insert(financialTransactions).values({
      userId: beneficiaryUserId,
      type: "ADJUSTMENT",
      amount,
      reference: `ADMIN_CREDIT:${beneficiaryUserId}:${randomUUID()}`,
      metadata: { grantedByAdminId: adminUserId, reason: reason ?? null },
    });

    await creditBalance(tx, beneficiaryUserId, amount);

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "BALANCE_CREDITED",
      targetType: "profile",
      targetId: beneficiaryUserId,
      metadata: { amount, reason: reason ?? null },
    });
  });
}
