import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { courses } from "@/db/schema/courses";
import { payments } from "@/db/schema/payments";
import { sales } from "@/db/schema/sales";
import {
  computeDirectSaleCommission,
  getEffectiveDirectSaleRule,
} from "@/repositories/commission-rules";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { createCommissionEvent } from "@/services/mlm/commission";
import { propagateSaleVolume } from "@/services/mlm/propagate-sale-volume";

type PurchaseMetadata = {
  courseId?: string;
  ambassadorUserId?: string | null;
  attributionId?: string | null;
};

// The pendant of activate-registration.ts for a course purchase: payment
// confirmed -> sales row created -> access unlocked (via
// repositories/courses.ts's hasCourseAccess reading sales). Idempotent —
// a payment already CONFIRMED is a no-op, same rule as
// activate-registration.ts, so a redelivered webhook never creates a
// second sale.
//
// A direct purchase with no ambassador attributed pays no commission at
// all (TEST 6 of the master prompt) — this only pays one when
// initiateCoursePurchase actually resolved an attribution from the buyer's
// referral cookie. Self-referral (buying through your own link) is
// silently dropped rather than rejected: the sale still goes through, it
// just earns no commission, since erroring out a legitimate purchase over
// a stale cookie would be worse than the abuse it prevents.
export async function confirmCoursePurchase(tx: Executor, paymentId: string) {
  const payment = await tx.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) {
    throw new Error(`Paiement introuvable : ${paymentId}`);
  }
  if (payment.status === "CONFIRMED") {
    return tx.query.sales.findFirst({ where: eq(sales.paymentId, paymentId) });
  }

  const metadata = payment.metadata as PurchaseMetadata | null;
  const courseId = metadata?.courseId;
  if (!courseId) {
    throw new Error(`Paiement ${paymentId} sans courseId en métadonnée.`);
  }
  const course = await tx.query.courses.findFirst({
    where: eq(courses.id, courseId),
  });
  if (!course) {
    throw new Error(`Formation introuvable pour le paiement ${paymentId}.`);
  }

  const ambassadorUserId =
    metadata?.ambassadorUserId &&
    metadata.ambassadorUserId !== payment.beneficiaryUserId
      ? metadata.ambassadorUserId
      : null;
  const attributionId = ambassadorUserId
    ? (metadata?.attributionId ?? null)
    : null;

  await tx
    .update(payments)
    .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
    .where(eq(payments.id, paymentId));

  const [sale] = await tx
    .insert(sales)
    .values({
      buyerUserId: payment.beneficiaryUserId,
      courseId: course.id,
      paymentId: payment.id,
      pricePaid: payment.amount,
      businessVolume: course.businessVolume ?? 0,
      ambassadorUserId,
      attributionId,
    })
    .returning();

  if (ambassadorUserId) {
    const rule = await getEffectiveDirectSaleRule(tx, {
      courseId: course.id,
      category: course.category,
    });
    if (rule) {
      const bvValueInCfa = await getCurrentParameterValue(
        tx,
        "bv.value_in_cfa",
      );
      const amount = computeDirectSaleCommission(rule, {
        pricePaid: sale.pricePaid,
        businessVolume: sale.businessVolume,
        bvValueInCfa,
      });
      if (amount > 0) {
        await createCommissionEvent(tx, {
          beneficiaryUserId: ambassadorUserId,
          sourceUserId: payment.beneficiaryUserId,
          type: "DIRECT_SALE",
          amount,
          dedupeKey: `DIRECT_SALE:${sale.id}`,
          metadata: {
            saleId: sale.id,
            courseId: course.id,
            commissionRuleId: rule.id,
          },
        });
      }
    }

    // Independent of whether a DIRECT_SALE rule paid a commission just now
    // — the BV still climbs the ambassador's own ancestor chain (section
    // 15/16 of the master prompt), which is what may complete one of
    // *their* upline's generations later.
    await propagateSaleVolume(tx, ambassadorUserId, sale.businessVolume);
  }

  return sale;
}

export async function confirmCoursePurchaseInNewTransaction(paymentId: string) {
  return db.transaction((tx) => confirmCoursePurchase(tx, paymentId));
}
