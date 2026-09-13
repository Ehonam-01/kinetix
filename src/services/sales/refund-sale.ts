import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { commissionEvents } from "@/db/schema/commission-events";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { profiles } from "@/db/schema/profiles";
import { refunds } from "@/db/schema/refunds";
import { sales } from "@/db/schema/sales";
import { creditBalance } from "@/services/mlm/credit-balance";
import { propagateSaleVolume } from "@/services/mlm/propagate-sale-volume";
import { logAdminAction } from "@/services/admin/audit-log";

// Admin-only (section 22 of the master prompt: refunds are a required
// feature, always a reversal, never a deletion of the original sale/
// commission rows — see MLM_RULES.md/FINANCIAL_MODEL.md). Three effects,
// all inside one transaction:
//
// 1. sales.status -> REFUNDED (atomic guard: a sale can only be refunded
//    once). Access is revoked or kept per refunds.accessRevoked — a real,
//    respected policy choice (repositories/courses.ts's hasCourseAccess
//    checks it), not just a logged flag.
// 2. If the sale had an attributed ambassador who was paid a DIRECT_SALE
//    commission, that exact commission is reversed — a new negative
//    COMMISSION_REVERSAL ledger row, never a rewrite of the original.
//    Clean 1:1 mapping: one sale produced at most one DIRECT_SALE
//    commission, so reversing it fully is always correct.
// 3. The BV this sale contributed is subtracted back out of the
//    ambassador's ancestor chain (propagateSaleVolume with a negative
//    amount) — deliberately does NOT un-complete an already-COMPLETED
//    generation or claw back a GENERATION commission that may have been
//    paid from cumulative BV across several sales, only one of which is
//    being refunded here. See ARCHITECTURE.md for why that's scoped out.
export async function refundSale(
  adminUserId: string,
  saleId: string,
  input: { reason?: string; revokeAccess: boolean },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut rembourser une vente.");
    }

    const sale = await tx.query.sales.findFirst({
      where: eq(sales.id, saleId),
    });
    if (!sale) {
      throw new Error("Vente introuvable.");
    }
    if (sale.status === "REFUNDED") {
      throw new Error("Cette vente a déjà été remboursée.");
    }

    const [updatedSale] = await tx
      .update(sales)
      .set({ status: "REFUNDED" })
      .where(and(eq(sales.id, saleId), eq(sales.status, "CONFIRMED")))
      .returning();
    if (!updatedSale) {
      throw new Error("Cette vente a déjà été remboursée.");
    }

    const [refund] = await tx
      .insert(refunds)
      .values({
        saleId,
        initiatedByAdminId: adminUserId,
        reason: input.reason,
        accessRevoked: input.revokeAccess,
      })
      .returning();

    if (sale.ambassadorUserId) {
      const originalEvent = await tx.query.commissionEvents.findFirst({
        where: eq(commissionEvents.dedupeKey, `DIRECT_SALE:${sale.id}`),
      });
      if (originalEvent) {
        await tx.insert(financialTransactions).values({
          userId: originalEvent.beneficiaryUserId,
          type: "COMMISSION_REVERSAL",
          amount: -originalEvent.amount,
          reference: `REFUND:${refund.id}:DIRECT_SALE`,
          commissionEventId: originalEvent.id,
          metadata: {
            saleId: sale.id,
            refundId: refund.id,
            reversedCommissionEventId: originalEvent.id,
          },
        });
        await creditBalance(
          tx,
          originalEvent.beneficiaryUserId,
          -originalEvent.amount,
        );
      }

      await propagateSaleVolume(
        tx,
        sale.ambassadorUserId,
        -sale.businessVolume,
      );
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SALE_REFUNDED",
      targetType: "sale",
      targetId: saleId,
      metadata: {
        refundId: refund.id,
        reason: input.reason ?? null,
        accessRevoked: input.revokeAccess,
      },
    });

    return { sale: updatedSale, refund };
  });
}
