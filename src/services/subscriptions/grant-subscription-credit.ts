import "server-only";
import { resolveSaleAttribution } from "@/services/attribution/resolve-referral";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { installmentPlans } from "@/db/schema/installment-plans";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { subscriptions } from "@/db/schema/subscriptions";
import { userBalances } from "@/db/schema/user-balances";
import { getBalance } from "@/repositories/financial-transactions";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { logAdminAction } from "@/services/admin/audit-log";
import { SUBSCRIPTION_PRICE_MAX } from "@/services/admin/input-limits";
import {
  computeSubscriptionCommission,
  confirmSubscriptionPurchase,
} from "./confirm-subscription-payment";

// Admin-only, mirrors services/payments/admin-credit.ts's grantAdminCredit.
// The one way to lift a permanently-frozen account (dashboard/layout.tsx,
// SubscriptionStatus.permanentlyFrozen — self-service payment no longer
// works once the 7-day grace period after expiry has passed, explicit user
// decision), and the way to validate a first subscription whatever the
// member actually has: going through the real confirmSubscriptionPurchase,
// it activates the account and resets the freeze clock like any payment.
//
// First subscription (explicit user decision): the amount is not the price
// in force but what is really there — the open cagnotte, then what the
// admin received off-site, then the available balance up to the price. The
// cagnotte and the balance are spent, so the same money can't also be
// refunded or withdrawn, and the sponsor's commission is prorated to that
// amount: nothing there, no direct commission. Renewals carry no commission
// and stay a free year at the price in force, without touching the balance.

function splitCredit(input: {
  price: number;
  deposits: number;
  balance: number;
  receivedOutside: number;
}) {
  const fromBalance = Math.min(
    input.balance,
    Math.max(0, input.price - input.deposits - input.receivedOutside),
  );
  return {
    fromBalance,
    amount: input.deposits + input.receivedOutside + fromBalance,
  };
}

function findOpenPlan(executor: Executor, userId: string) {
  return executor.query.installmentPlans.findFirst({
    where: and(
      eq(installmentPlans.userId, userId),
      eq(installmentPlans.status, "OPEN"),
    ),
  });
}

// What the admin needs before validating a first subscription; null when
// the member already had one.
export async function getSubscriptionCreditPreview(userId: string) {
  const prior = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    orderBy: desc(subscriptions.expiresAt),
  });
  if (prior) return null;

  const [attribution, price, businessVolume, balance, plan] = await Promise.all(
    [
      resolveSaleAttribution(userId, undefined),
      getCurrentParameterValue(db, "subscription.price_in_cfa"),
      getCurrentParameterValue(db, "subscription.business_volume"),
      getBalance(db, userId),
      findOpenPlan(db, userId),
    ],
  );
  const hasSponsor = Boolean(
    attribution?.ambassadorUserId ?? plan?.ambassadorUserId,
  );
  const commission = hasSponsor
    ? await computeSubscriptionCommission(db, {
        pricePaid: price,
        businessVolume,
        referencePrice: null,
      })
    : null;
  return {
    price,
    deposits: plan?.paidAmount ?? 0,
    balance: balance.availableBalance,
    hasSponsor,
    fullCommission: commission?.amount ?? 0,
  };
}

export async function grantSubscriptionCredit(
  adminUserId: string,
  beneficiaryUserId: string,
  receivedOutside = 0,
) {
  if (
    !Number.isInteger(receivedOutside) ||
    receivedOutside < 0 ||
    receivedOutside > SUBSCRIPTION_PRICE_MAX
  ) {
    throw new Error("Le montant reçu hors du site est invalide.");
  }
  // Read before the transaction: it uses its own connection.
  const attribution = await resolveSaleAttribution(
    beneficiaryUserId,
    undefined,
  );
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut accorder un abonnement.");
    }

    // Locked, so two validations at once can't both see "first subscription"
    // and spend the member's money twice.
    const [member] = await tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, beneficiaryUserId))
      .for("update");
    if (!member) throw new Error("Membre introuvable.");

    const price = await getCurrentParameterValue(
      tx,
      "subscription.price_in_cfa",
    );
    const prior = await tx.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, beneficiaryUserId),
    });

    const [plan] = prior
      ? []
      : await tx
          .select()
          .from(installmentPlans)
          .where(
            and(
              eq(installmentPlans.userId, beneficiaryUserId),
              eq(installmentPlans.status, "OPEN"),
            ),
          )
          .for("update");
    const deposits = plan?.paidAmount ?? 0;
    const { amount, fromBalance } = prior
      ? { amount: price, fromBalance: 0 }
      : splitCredit({
          price,
          deposits,
          balance: (await getBalance(tx, beneficiaryUserId)).availableBalance,
          receivedOutside,
        });

    const [payment] = await tx
      .insert(payments)
      .values({
        beneficiaryUserId,
        payerUserId: fromBalance > 0 ? beneficiaryUserId : null,
        grantedByAdminId: adminUserId,
        purpose: "SUBSCRIPTION",
        method: "ADMIN_CREDIT",
        amount,
        status: "PENDING",
        idempotencyKey: `ADMIN_CREDIT:SUBSCRIPTION:${beneficiaryUserId}:${randomUUID()}`,
        // The member's sponsor, as a real payment would carry it — without
        // it the sponsor's first-subscription commission was silently
        // skipped (e.g. a member who paid on the outside shop and was
        // activated here).
        metadata: {
          ambassadorUserId:
            attribution?.ambassadorUserId ?? plan?.ambassadorUserId ?? null,
          attributionId:
            attribution?.attributionId ?? plan?.attributionId ?? null,
          referencePrice: prior ? null : price,
          // Set only with deposits to use: an empty plan is simply removed
          // by confirmSubscriptionPurchase.
          installmentPlanId: deposits > 0 ? plan.id : null,
        },
      })
      .returning();

    if (fromBalance > 0) {
      const [debited] = await tx
        .update(userBalances)
        .set({
          availableBalance: sql`${userBalances.availableBalance} - ${fromBalance}`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(userBalances.userId, beneficiaryUserId),
            sql`${userBalances.availableBalance} >= ${fromBalance}`,
          ),
        )
        .returning();
      if (!debited) {
        throw new Error("Le solde du membre vient de changer, réessayez.");
      }
      await tx.insert(financialTransactions).values({
        userId: beneficiaryUserId,
        type: "PAYMENT",
        amount: -fromBalance,
        reference: payment.id,
        metadata: { beneficiaryUserId, grantedByAdminId: adminUserId },
      });
    }

    const activated = await confirmSubscriptionPurchase(tx, payment.id);

    if (deposits > 0) {
      await tx
        .update(installmentPlans)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          subscriptionPaymentId: payment.id,
        })
        .where(eq(installmentPlans.id, plan.id));
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SUBSCRIPTION_CREDIT_GRANTED",
      targetType: "profile",
      targetId: beneficiaryUserId,
      metadata: {
        amount,
        priceInForce: price,
        deposits,
        receivedOutside: prior ? 0 : receivedOutside,
        fromBalance,
        paymentId: payment.id,
      },
    });

    return activated;
  });
}
