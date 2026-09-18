import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { subscriptions } from "@/db/schema/subscriptions";
import {
  computeDirectSaleCommission,
  getEffectiveSubscriptionRule,
} from "@/repositories/commission-rules";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { createCommissionEvent } from "@/services/mlm/commission";
import { propagateSaleVolume } from "@/services/mlm/propagate-sale-volume";
import {
  AMBASSADOR_TERMS_VERSION,
  joinAmbassadorProgram,
} from "@/services/ambassador/join-program";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";

type SubscriptionPaymentMetadata = {
  ambassadorUserId?: string | null;
  attributionId?: string | null;
};

// Calendar-year arithmetic, not a fixed 365-day duration: a fixed
// millisecond offset silently shortchanges a subscriber by a day whenever
// the period crosses a leap day (e.g. 2027-09-15 -> 2028-09-15 is 366 days,
// not 365) — caught live while verifying this function against a real
// renewal spanning 2028.
function addOneYear(date: Date): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + 1);
  return result;
}

// The pendant of confirm-course-purchase.ts (retired by this pivot) and
// activate-registration.ts: payment confirmed -> subscription row inserted
// -> full course access unlocked (via repositories/courses.ts's
// hasCourseAccess reading subscriptions). Idempotent — a payment already
// CONFIRMED is a no-op, so a redelivered webhook never inserts a second
// subscription row for the same payment.
//
// Renewal semantics: if the buyer's most recent subscription is still
// active, the new period starts from its expiry (early renewal never loses
// paid days); otherwise (first-ever subscription, or renewing after
// expiring) it starts from now. Either way expiresAt is exactly one year
// later, so it always strictly grows — what lets getSubscriptionStatus just
// check the single most-recent row (repositories/subscriptions.ts).
//
// Commission timing — explicit user decision: an ambassador is paid once,
// on the buyer's very first subscription ever, never again on a renewal.
// BV propagation is NOT limited to the first subscription though: every
// confirmed period (initial or renewal) is a real sale event that
// contributes to the ambassador's own upline generations, same as every
// course purchase used to under the old model.
export async function confirmSubscriptionPurchase(
  tx: Executor,
  paymentId: string,
) {
  const payment = await tx.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) {
    throw new Error(`Paiement introuvable : ${paymentId}`);
  }
  if (payment.status === "CONFIRMED") {
    return tx.query.subscriptions.findFirst({
      where: eq(subscriptions.paymentId, paymentId),
    });
  }

  const metadata = payment.metadata as SubscriptionPaymentMetadata | null;
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

  const priorSubscription = await tx.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, payment.beneficiaryUserId),
    orderBy: desc(subscriptions.expiresAt),
  });
  const isFirstSubscription = !priorSubscription;

  const now = new Date();
  const base =
    priorSubscription && priorSubscription.expiresAt.getTime() > now.getTime()
      ? priorSubscription.expiresAt
      : now;
  const expiresAt = addOneYear(base);

  const businessVolume = await getCurrentParameterValue(
    tx,
    "subscription.business_volume",
  );

  const [subscription] = await tx
    .insert(subscriptions)
    .values({
      userId: payment.beneficiaryUserId,
      paymentId: payment.id,
      expiresAt,
      pricePaid: payment.amount,
      businessVolume,
      ambassadorUserId,
      attributionId,
    })
    .returning();

  // A subscription is now the platform's real paid product (the old
  // paid-registration flow is dormant, migration 0031), so paying for one
  // activates the account the same way confirming registration used to.
  const buyerProfile = await tx.query.profiles.findFirst({
    where: eq(profiles.id, payment.beneficiaryUserId),
  });
  if (buyerProfile && buyerProfile.status !== "ACTIVE") {
    await tx
      .update(profiles)
      .set({ status: "ACTIVE" })
      .where(eq(profiles.id, payment.beneficiaryUserId));
  }

  // Registration's "Devenir ambassadeur" checkbox (profiles.wants_ambassador)
  // is only ever acted on here: payment is mandatory before anyone can join
  // the program (explicit product decision), and this is the first moment
  // the buyer is actually ACTIVE. Reuses this same transaction —
  // joinAmbassadorProgram takes an Executor for exactly this call site.
  // Silently skipped if they're already an ambassador (e.g. a renewal, or
  // they joined manually from the dashboard before this payment landed).
  if (buyerProfile?.wantsAmbassador) {
    const alreadyAmbassador = await tx.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, payment.beneficiaryUserId),
    });
    if (!alreadyAmbassador) {
      await joinAmbassadorProgram(tx, payment.beneficiaryUserId, {
        termsVersion: AMBASSADOR_TERMS_VERSION,
      });
    }
  }

  if (ambassadorUserId) {
    if (isFirstSubscription) {
      const rule = await getEffectiveSubscriptionRule(tx);
      if (rule) {
        const bvValueInCfa = await getCurrentParameterValue(
          tx,
          "bv.value_in_cfa",
        );
        const amount = computeDirectSaleCommission(rule, {
          pricePaid: subscription.pricePaid,
          businessVolume: subscription.businessVolume,
          bvValueInCfa,
        });
        if (amount > 0) {
          await createCommissionEvent(tx, {
            beneficiaryUserId: ambassadorUserId,
            sourceUserId: payment.beneficiaryUserId,
            type: "DIRECT_SALE",
            amount,
            dedupeKey: `DIRECT_SALE:SUBSCRIPTION:${subscription.id}`,
            metadata: {
              subscriptionId: subscription.id,
              commissionRuleId: rule.id,
            },
          });
        }
      }
    }

    await propagateSaleVolume(
      tx,
      ambassadorUserId,
      subscription.businessVolume,
    );
  }

  return subscription;
}

export async function confirmSubscriptionPurchaseInNewTransaction(
  paymentId: string,
) {
  return db.transaction((tx) => confirmSubscriptionPurchase(tx, paymentId));
}
