import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { courses } from "@/db/schema/courses";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { sales } from "@/db/schema/sales";
import { subscriptions } from "@/db/schema/subscriptions";
import { OTHER_COUNTRY } from "@/config/paydunya-countries";
import {
  COURSE_SALE_DEFAULT_RATE,
  computeDirectSaleCommission,
  getEffectiveCourseSaleRule,
} from "@/repositories/commission-rules";
import { hasCourseAccess, isCourseVisible } from "@/repositories/courses";
import { createCommissionEvent } from "@/services/mlm/commission";
import { isSaspayEnabled } from "@/repositories/payment-settings";
import { hasActiveSubscription } from "@/repositories/subscriptions";
import { resolveSaleAttribution } from "@/services/attribution/resolve-referral";
import { getActivePaymentProvider } from "@/services/payments/provider-selector";
import { saspayProvider } from "@/services/payments/saspay";

// A course bought on its own, for life (explicit user decision): its
// salePrice, set by the admin, by mobile money, in one payment. The buyer
// doesn't become a member: an account that never subscribed becomes a
// learner (profiles.accountType), who only reaches the courses they own.

type Course = typeof courses.$inferSelect;
type Profile = typeof profiles.$inferSelect;

// Why this account can't buy this course, or null when it can. Shown on
// the purchase page as is.
export async function coursePurchaseRefusal(
  executor: Executor,
  profile: Pick<Profile, "id" | "accountType" | "status" | "role">,
  course: Course,
): Promise<string | null> {
  if (!isCourseVisible(course) || course.comingSoon) {
    return "Cette formation n'est pas encore ouverte.";
  }
  if (course.salePrice === null) {
    return "Cette formation n'est accessible qu'avec l'abonnement.";
  }
  if (profile.status === "SUSPENDED" || profile.status === "DELETED") {
    return "Ce compte est suspendu. Contacte le support.";
  }
  if (await hasCourseAccess(executor, profile.id, course.id)) {
    return "Tu as déjà accès à cette formation.";
  }
  // A member who already subscribed once (whose account opens with the
  // subscription): renewing gives back every course.
  if (
    profile.accountType === "MEMBER" &&
    (await hasSubscribed(executor, profile.id))
  ) {
    return "Ton compte est un compte membre : renouvelle ton abonnement pour retrouver toutes les formations.";
  }
  return null;
}

async function hasSubscribed(executor: Executor, userId: string) {
  const row = await executor.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  return Boolean(row);
}

export async function initiateCoursePurchase(input: {
  buyerUserId: string;
  courseId: string;
  email: string;
  fullName: string;
  returnUrl: string;
  visitorToken?: string;
  country?: string;
  operator?: string;
  phone?: string;
  otp?: string;
  address?: string;
}) {
  const [profile, course] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, input.buyerUserId) }),
    db.query.courses.findFirst({ where: eq(courses.id, input.courseId) }),
  ]);
  if (!profile || !course) throw new Error("Formation introuvable.");
  const refusal = await coursePurchaseRefusal(db, profile, course);
  if (refusal) throw new Error(refusal);

  if (input.country === OTHER_COUNTRY && !(await isSaspayEnabled(db))) {
    throw new Error("Ce moyen de paiement n'est plus proposé pour le moment.");
  }
  const provider =
    input.country === OTHER_COUNTRY
      ? saspayProvider
      : await getActivePaymentProvider(db);
  // Same rule as the subscription: the sponsor named at sign-up when an
  // active ambassador, else the referral link followed.
  const attribution = await resolveSaleAttribution(
    input.buyerUserId,
    input.visitorToken,
  );
  const amount = course.salePrice!;
  const idempotencyKey = `COURSE_PURCHASE:${input.buyerUserId}:${randomUUID()}`;
  const [firstName, ...rest] = input.fullName.trim().split(/\s+/);

  // Written before calling the provider, like a subscription payment: a
  // charge that goes through while the call fails on our side still leaves
  // something to reconcile.
  const [pendingPayment] = await db
    .insert(payments)
    .values({
      beneficiaryUserId: input.buyerUserId,
      purpose: "COURSE_PURCHASE",
      method: "MOBILE_MONEY",
      amount,
      provider: provider.name,
      idempotencyKey,
      status: "PENDING",
      metadata: {
        courseId: course.id,
        ambassadorUserId: attribution?.ambassadorUserId ?? null,
        attributionId: attribution?.attributionId ?? null,
      },
    })
    .returning();

  const intent = await provider.createPayment({
    amount,
    description: `Formation : ${course.title}`.slice(0, 120),
    customer: {
      email: input.email,
      firstName,
      lastName: rest.join(" ") || firstName,
      phone: input.phone,
    },
    returnUrl: input.returnUrl,
    idempotencyKey,
    metadata: { beneficiary_user_id: input.buyerUserId },
    operator: input.operator,
    country: input.country,
    otp: input.otp,
    address: input.address,
  });

  const [payment] = await db
    .update(payments)
    .set({
      providerReference: intent.providerReference,
      ...(intent.pendingWizallConfirmation && {
        metadata: {
          ...((pendingPayment.metadata as Record<string, unknown> | null) ??
            {}),
          wizallTransactionId: intent.pendingWizallConfirmation.transactionId,
          wizallPhone: input.phone,
        },
      }),
    })
    .where(eq(payments.id, pendingPayment.id))
    .returning();

  return {
    payment,
    checkoutUrl: intent.checkoutUrl,
    confirmationMessage: intent.confirmationMessage,
    pendingWizallConfirmation: intent.pendingWizallConfirmation,
  };
}

// Payment confirmed -> the sale, which opens the course for life
// (repositories/courses.ts hasCourseAccess reads sales). Reached from
// processWebhookEvent only, so whichever path confirms first (webhook, the
// purchase page's check, an admin reconcile) is the only one that does
// anything.
export async function confirmCoursePurchase(tx: Executor, paymentId: string) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .for("update");
  if (!payment || payment.status === "CONFIRMED") return null;

  await tx
    .update(payments)
    .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
    .where(eq(payments.id, paymentId));

  const metadata = (payment.metadata ?? {}) as {
    courseId?: string;
    ambassadorUserId?: string | null;
    attributionId?: string | null;
  };
  if (!payment.beneficiaryUserId || !metadata.courseId) {
    throw new Error(
      `Achat de formation sans acheteur ou sans cours (${paymentId}).`,
    );
  }
  const buyerUserId = payment.beneficiaryUserId;

  const existing = await tx.query.sales.findFirst({
    where: eq(sales.paymentId, payment.id),
  });
  if (existing) return existing;

  const [sale] = await tx
    .insert(sales)
    .values({
      buyerUserId,
      courseId: metadata.courseId,
      paymentId: payment.id,
      pricePaid: payment.amount,
      // Counts for nobody's progression (explicit user decision): the
      // sponsor's 15 % is the only thing a course sold on its own pays.
      businessVolume: 0,
      ambassadorUserId:
        metadata.ambassadorUserId && metadata.ambassadorUserId !== buyerUserId
          ? metadata.ambassadorUserId
          : null,
      attributionId: metadata.attributionId ?? null,
    })
    .returning();

  // The sponsor's 15 % of what was paid (explicit user decision), through
  // the usual commission path: once per sale (refund-sale.ts reverses it
  // by this same key), only while the sponsor's own subscription is valid.
  // No volume: a course sold alone counts for nobody's progression.
  if (sale.ambassadorUserId) {
    const amount = await courseSaleCommission(tx, sale);
    if (amount.value > 0) {
      await createCommissionEvent(tx, {
        beneficiaryUserId: sale.ambassadorUserId,
        sourceUserId: buyerUserId,
        type: "DIRECT_SALE",
        amount: amount.value,
        dedupeKey: `DIRECT_SALE:${sale.id}`,
        metadata: {
          saleId: sale.id,
          courseId: sale.courseId,
          commissionRuleId: amount.ruleId,
        },
      });
    }
  }

  // An account that never subscribed becomes a learner: not a member, it
  // only reaches the courses it owns (a member account that never paid is
  // otherwise stopped by the "pay your subscription" screen).
  if (!(await hasActiveSubscription(tx, buyerUserId))) {
    await tx
      .update(profiles)
      .set({ accountType: "LEARNER" })
      .where(
        and(
          eq(profiles.id, buyerUserId),
          eq(profiles.status, "PENDING_PAYMENT"),
        ),
      );
  }

  return sale;
}

async function courseSaleCommission(
  executor: Executor,
  sale: { courseId: string; pricePaid: number },
) {
  const rule = await getEffectiveCourseSaleRule(executor, sale.courseId);
  if (!rule) {
    return {
      value: Math.floor((sale.pricePaid * COURSE_SALE_DEFAULT_RATE) / 10_000),
      ruleId: null,
    };
  }
  return {
    value: computeDirectSaleCommission(rule, {
      pricePaid: sale.pricePaid,
      businessVolume: 0,
      bvValueInCfa: 0,
    }),
    ruleId: rule.id,
  };
}
