import "server-only";
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { installmentPlans } from "@/db/schema/installment-plans";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { subscriptions } from "@/db/schema/subscriptions";
import { computeWithdrawalFee } from "@/lib/withdrawal-fee";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { getWithdrawalFeeSettings } from "@/repositories/withdrawals";
import { logAdminAction } from "@/services/admin/audit-log";
import { resolveSaleAttribution } from "@/services/attribution/resolve-referral";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import { splitPaymentChoices, splitTranches } from "@/lib/split-payment";
import { createCommissionEvent } from "@/services/mlm/commission";
import {
  addOneYear,
  computeSubscriptionCommission,
  confirmSubscriptionPurchase,
} from "./confirm-subscription-payment";
import { initiateSubscriptionPayment } from "./initiate-subscription-payment";
import { alertAdmins } from "@/services/notifications/admin-alerts";

// Paying the first annual subscription in several deposits
// (db/schema/installment-plans.ts). Every plan opened now is a payment in
// 3 times (split, explicit user decision, lib/split-payment.ts):
// - the first tranche opens the subscription right away (account, tree,
//   courses), running until the deadline, INSTALLMENT_MONTHS after it;
// - the two other tranches are paid whenever the member wants before the
//   deadline; the last one extends the subscription to a full year from
//   its start and only then pays the sponsor's commission;
// - past the deadline unpaid, the subscription simply runs out: the
//   account freezes like any expired one until the rest is paid — the plan
//   never expires and nothing is refunded.
// Older plans (split false, the free-deposit "cagnotte") keep their rules
// until they end:
// - a member who has never subscribed opens a plan at today's price;
// - from the first confirmed deposit they have INSTALLMENT_MONTHS to reach
//   the price; the subscription is activated the moment they do, exactly
//   as a one-off payment (commission, tree, account) — never before;
// - past the deadline the plan expires, the account isn't activated, and
//   what was paid is refunded minus the withdrawal fees.
export const INSTALLMENT_MONTHS = 3;
export const INSTALLMENT_MIN_DEPOSIT = 1000;
export const INSTALLMENT_REMINDER_DAYS = 7;
// A deposit still PENDING after this long is treated as abandoned when
// working out how much is left to pay.
const PENDING_DEPOSIT_WINDOW_MS = 60 * 60 * 1000;

type PayoutDetails = {
  country: string | null;
  operator: string | null;
  phone: string | null;
};

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

const fmt = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;
const fmtDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "UTC" });

// The member's most recent plan, whatever its status.
export function getLatestInstallmentPlan(executor: Executor, userId: string) {
  return executor.query.installmentPlans.findFirst({
    where: eq(installmentPlans.userId, userId),
    orderBy: desc(installmentPlans.createdAt),
  });
}

// Why a member can't pay in installments, or null when they can: only a
// first subscription, and only one try — after an expired plan, the
// subscription is paid in full.
export async function installmentIneligibility(
  executor: Executor,
  userId: string,
): Promise<string | null> {
  const [profile, subscription, latest] = await Promise.all([
    executor.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    executor.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    }),
    getLatestInstallmentPlan(executor, userId),
  ]);
  if (
    !profile ||
    profile.status === "DELETED" ||
    profile.status === "SUSPENDED"
  ) {
    return "Ce compte ne peut pas payer en plusieurs fois.";
  }
  if (subscription) {
    // Their own payment in 3 times opened it: they keep paying the rest.
    if (latest?.status === "OPEN" && latest.split) return null;
    return "Le paiement en plusieurs fois est réservé à la première inscription.";
  }
  if (latest?.status === "EXPIRED") {
    return "Votre précédente cagnotte a expiré : l'abonnement se paie désormais en une fois.";
  }
  if (latest?.status === "COMPLETED") {
    return "Votre cagnotte est déjà complète.";
  }
  if (latest?.status !== "OPEN") {
    const price = await getCurrentParameterValue(
      executor,
      "subscription.price_in_cfa",
    );
    if (!splitTranches(price)) {
      return "Le paiement en 3 fois n'est pas proposé à ce prix.";
    }
  }
  return null;
}

// Deposits started but not yet confirmed, still recent enough to land.
async function pendingDepositsTotal(executor: Executor, planId: string) {
  const [row] = await executor
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
    .from(payments)
    .where(
      and(
        eq(payments.purpose, "INSTALLMENT"),
        eq(payments.status, "PENDING"),
        sql`${payments.metadata}->>'installmentPlanId' = ${planId}`,
        gt(
          payments.createdAt,
          new Date(Date.now() - PENDING_DEPOSIT_WINDOW_MS),
        ),
      ),
    );
  return Number(row?.total ?? 0);
}

// What the member can deposit right now: between min and max (both
// inclusive), or max = 0 when nothing more can be started. For a payment
// in 3 times, only the amounts in `choices` (the next tranche, or all
// that's left).
export async function depositBounds(
  executor: Executor,
  plan: {
    id: string;
    targetAmount: number;
    paidAmount: number;
    split: boolean;
  },
): Promise<{ min: number; max: number; choices: number[] | null }> {
  const pending = await pendingDepositsTotal(executor, plan.id);
  if (plan.split) {
    const choices = splitPaymentChoices(
      plan.targetAmount,
      plan.paidAmount,
      pending,
    );
    return {
      min: choices.length ? Math.min(...choices) : 0,
      max: choices.length ? Math.max(...choices) : 0,
      choices,
    };
  }
  const remaining = Math.max(0, plan.targetAmount - plan.paidAmount - pending);
  return {
    min: Math.min(INSTALLMENT_MIN_DEPOSIT, remaining),
    max: remaining,
    choices: null,
  };
}

// Starts one deposit by mobile money, opening the plan on the first one.
export async function initiateInstallmentDeposit(input: {
  buyerUserId: string;
  email: string;
  fullName: string;
  returnUrl: string;
  visitorToken?: string;
  amount: number;
  country: string;
  operator: string;
  phone: string;
  otp?: string;
  address?: string;
}) {
  // Checked even with a plan already open: a member who got their
  // subscription another way can't keep paying into it.
  const reason = await installmentIneligibility(db, input.buyerUserId);
  if (reason) throw new Error(reason);
  let plan = await db.query.installmentPlans.findFirst({
    where: and(
      eq(installmentPlans.userId, input.buyerUserId),
      eq(installmentPlans.status, "OPEN"),
    ),
  });
  if (!plan) {
    const [price, attribution] = await Promise.all([
      getCurrentParameterValue(db, "subscription.price_in_cfa"),
      resolveSaleAttribution(input.buyerUserId, input.visitorToken),
    ]);
    [plan] = await db
      .insert(installmentPlans)
      .values({
        userId: input.buyerUserId,
        targetAmount: price,
        split: true,
        ambassadorUserId: attribution?.ambassadorUserId ?? null,
        attributionId: attribution?.attributionId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    // Two first deposits started at once: use the plan the other one made.
    plan ??= await db.query.installmentPlans.findFirst({
      where: and(
        eq(installmentPlans.userId, input.buyerUserId),
        eq(installmentPlans.status, "OPEN"),
      ),
    });
    if (!plan) throw new Error("Impossible d'ouvrir la cagnotte.");
  } else if (
    !plan.split &&
    plan.deadlineAt &&
    plan.deadlineAt.getTime() < Date.now()
  ) {
    throw new Error(
      "Le délai de votre cagnotte est dépassé : elle va être clôturée et remboursée.",
    );
  }

  const { min, max, choices } = await depositBounds(db, plan);
  if (max === 0) {
    throw new Error(
      "Un versement est déjà en cours de confirmation pour le montant restant. Patientez quelques minutes.",
    );
  }
  if (choices && !choices.includes(input.amount)) {
    throw new Error(
      choices.length === 1
        ? `Le montant à payer est de ${fmt(choices[0])}.`
        : `Le montant à payer est de ${fmt(choices[0])}, ou ${fmt(choices[1])} pour tout régler.`,
    );
  }
  if (
    !Number.isInteger(input.amount) ||
    input.amount < min ||
    input.amount > max
  ) {
    throw new Error(
      min === max
        ? `Le montant restant à verser est de ${fmt(max)}.`
        : `Le versement doit être compris entre ${fmt(min)} et ${fmt(max)}.`,
    );
  }

  return initiateSubscriptionPayment({
    buyerUserId: input.buyerUserId,
    email: input.email,
    fullName: input.fullName,
    returnUrl: input.returnUrl,
    country: input.country,
    operator: input.operator,
    phone: input.phone,
    otp: input.otp,
    address: input.address,
    installment: { planId: plan.id, amount: input.amount },
  });
}

// A deposit confirmed by the provider (services/payments/
// process-webhook-event.ts). Idempotent: an already CONFIRMED payment is a
// no-op. Reaching the target creates and confirms the real SUBSCRIPTION
// payment in this same transaction.
export async function applyInstallmentDeposit(tx: Executor, paymentId: string) {
  // Locked, so a deposit confirmed by two paths at once is counted once
  // (security audit SEC-01).
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .for("update");
  if (!payment || payment.status === "CONFIRMED") return;

  await tx
    .update(payments)
    .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
    .where(eq(payments.id, paymentId));

  const metadata = payment.metadata as {
    installmentPlanId?: string;
    payout?: PayoutDetails;
  } | null;
  if (!metadata?.installmentPlanId) {
    console.error("Versement sans cagnotte :", paymentId);
    return;
  }

  const [plan] = await tx
    .select()
    .from(installmentPlans)
    .where(eq(installmentPlans.id, metadata.installmentPlanId))
    .for("update");
  if (!plan) return;

  const now = new Date();
  const paidAmount = plan.paidAmount + payment.amount;

  if (plan.status === "EXPIRED") {
    // Landed after the deadline: it's refunded with the rest.
    const fee = computeWithdrawalFee(
      paidAmount,
      await getWithdrawalFeeSettings(tx),
    ).fee;
    const refundFee = Math.min(fee, paidAmount);
    await tx
      .update(installmentPlans)
      .set({
        paidAmount,
        refundFee,
        refundAmount: paidAmount - refundFee,
        refundPayout: metadata.payout ?? plan.refundPayout,
      })
      .where(eq(installmentPlans.id, plan.id));
    return;
  }
  if (plan.status === "COMPLETED") {
    alertAdmins(
      `installment-overpaid:${paymentId}`,
      "Versement reçu sur une cagnotte déjà complète",
      [
        `Cagnotte : ${plan.id}`,
        `Versement : ${paymentId} (${payment.amount} F)`,
        "L'abonnement est déjà activé : ce versement est à rembourser manuellement au membre.",
      ],
    );
    return;
  }

  const firstDepositAt = plan.firstDepositAt ?? now;
  const deadlineAt =
    plan.deadlineAt ?? addMonths(firstDepositAt, INSTALLMENT_MONTHS);
  await tx
    .update(installmentPlans)
    .set({
      paidAmount,
      firstDepositAt,
      deadlineAt,
      refundPayout: metadata.payout ?? plan.refundPayout,
    })
    .where(eq(installmentPlans.id, plan.id));

  if (plan.split) {
    await applySplitTranche(tx, plan, {
      amount: payment.amount,
      paidAmount,
      deadlineAt,
      now,
    });
    return;
  }

  if (paidAmount < plan.targetAmount) return;

  const [subscriptionPayment] = await tx
    .insert(payments)
    .values({
      beneficiaryUserId: plan.userId,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount: plan.targetAmount,
      provider: "INSTALLMENTS",
      idempotencyKey: `INSTALLMENTS:${plan.id}`,
      status: "PENDING",
      metadata: {
        ambassadorUserId: plan.ambassadorUserId,
        attributionId: plan.attributionId,
        installmentPlanId: plan.id,
      },
    })
    .returning();
  await confirmSubscriptionPurchase(tx, subscriptionPayment.id);
  await tx
    .update(installmentPlans)
    .set({
      status: "COMPLETED",
      completedAt: now,
      subscriptionPaymentId: subscriptionPayment.id,
    })
    .where(eq(installmentPlans.id, plan.id));
}

// One tranche of a payment in 3 times, already added to the plan. The
// first one opens the subscription until the deadline; each later one adds
// to what the subscription records as paid; the one that completes the
// price extends it to a full year and pays the sponsor's commission.
async function applySplitTranche(
  tx: Executor,
  plan: typeof installmentPlans.$inferSelect,
  tranche: { amount: number; paidAmount: number; deadlineAt: Date; now: Date },
) {
  let subscriptionPaymentId = plan.subscriptionPaymentId;
  if (!subscriptionPaymentId) {
    const [subscriptionPayment] = await tx
      .insert(payments)
      .values({
        beneficiaryUserId: plan.userId,
        purpose: "SUBSCRIPTION",
        method: "MOBILE_MONEY",
        amount: tranche.amount,
        provider: "INSTALLMENTS",
        idempotencyKey: `INSTALLMENTS:${plan.id}`,
        status: "PENDING",
        metadata: {
          ambassadorUserId: plan.ambassadorUserId,
          attributionId: plan.attributionId,
          installmentPlanId: plan.id,
          splitUntil: tranche.deadlineAt.toISOString(),
        },
      })
      .returning();
    await confirmSubscriptionPurchase(tx, subscriptionPayment.id);
    subscriptionPaymentId = subscriptionPayment.id;
    await tx
      .update(installmentPlans)
      .set({ subscriptionPaymentId })
      .where(eq(installmentPlans.id, plan.id));
  } else {
    await tx
      .update(subscriptions)
      .set({ pricePaid: sql`${subscriptions.pricePaid} + ${tranche.amount}` })
      .where(eq(subscriptions.paymentId, subscriptionPaymentId));
  }

  if (tranche.paidAmount < plan.targetAmount) return;

  const [subscription] = await tx
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paymentId, subscriptionPaymentId));
  if (!subscription) {
    throw new Error(
      `Abonnement du paiement en 3 fois introuvable : ${plan.id}`,
    );
  }
  // A full year from the day the first tranche opened it; reminders of
  // that real expiry come back on.
  await tx
    .update(subscriptions)
    .set({
      pricePaid: plan.targetAmount,
      expiresAt: addOneYear(subscription.startedAt),
      reminder7dSentAt: null,
      reminder1dSentAt: null,
    })
    .where(eq(subscriptions.id, subscription.id));
  await tx
    .update(installmentPlans)
    .set({ status: "COMPLETED", completedAt: tranche.now })
    .where(eq(installmentPlans.id, plan.id));

  // The commission held back since the first tranche: the same one, with
  // the same dedupe key, a one-off payment would have paid.
  if (plan.ambassadorUserId && plan.ambassadorUserId !== plan.userId) {
    const commission = await computeSubscriptionCommission(tx, {
      pricePaid: plan.targetAmount,
      businessVolume: subscription.businessVolume,
      referencePrice: null,
    });
    if (commission && commission.amount > 0) {
      await createCommissionEvent(tx, {
        beneficiaryUserId: plan.ambassadorUserId,
        sourceUserId: plan.userId,
        type: "DIRECT_SALE",
        amount: commission.amount,
        dedupeKey: `DIRECT_SALE:SUBSCRIPTION:${subscription.id}`,
        metadata: {
          subscriptionId: subscription.id,
          commissionRuleId: commission.rule.id,
          installmentPlanId: plan.id,
        },
      });
    }
  }
}

async function emailMember(
  userId: string,
  subject: string,
  lines: string[],
  linkLabel: string,
) {
  const to = await findAuthEmailByUserId(db, userId);
  if (!to) return;
  const url = `${getSiteEnv().SITE_URL}/dashboard/subscription`;
  await resendEmailProvider.sendEmail({
    to,
    subject,
    html: `${lines.map((l) => `<p>${l}</p>`).join("\n")}\n<p><a href="${url}">${linkLabel}</a></p>`,
    text: [
      ...lines.map((l) => l.replace(/<[^>]+>/g, "")),
      `${linkLabel} : ${url}`,
    ].join("\n\n"),
  });
}

// Daily (app/api/cron/subscription-reminders): closes the plans past their
// deadline and works out each refund, then reminds those whose deadline is
// near. Never throws; per-plan failures are logged.
export async function processInstallmentDeadlines(): Promise<{
  expired: number;
  reminded: number;
}> {
  let expired = 0;
  let reminded = 0;
  try {
    const fees = await getWithdrawalFeeSettings(db);
    const due = await db
      .select()
      .from(installmentPlans)
      .where(
        and(
          eq(installmentPlans.status, "OPEN"),
          // A payment in 3 times never expires: its subscription runs out.
          eq(installmentPlans.split, false),
          lt(installmentPlans.deadlineAt, new Date()),
        ),
      );
    for (const plan of due) {
      try {
        const refundFee = Math.min(
          computeWithdrawalFee(plan.paidAmount, fees).fee,
          plan.paidAmount,
        );
        const refundAmount = plan.paidAmount - refundFee;
        const [closed] = await db
          .update(installmentPlans)
          .set({
            status: "EXPIRED",
            expiredAt: new Date(),
            refundFee,
            refundAmount,
          })
          .where(
            and(
              eq(installmentPlans.id, plan.id),
              eq(installmentPlans.status, "OPEN"),
            ),
          )
          .returning();
        if (!closed) continue;
        expired += 1;
        await emailMember(
          plan.userId,
          "Ta cagnotte Kinetix Africa a expiré",
          [
            `Le délai de ${INSTALLMENT_MONTHS} mois pour compléter ta cagnotte est dépassé : tu avais versé <strong>${fmt(plan.paidAmount)}</strong> sur ${fmt(plan.targetAmount)}. Ton inscription n'a donc pas pu être activée.`,
            `Nous allons te rembourser <strong>${fmt(refundAmount)}</strong> sur ton compte mobile money (${fmt(plan.paidAmount)} versés, moins ${fmt(refundFee)} de frais de retrait).`,
            "Tu peux toujours rejoindre Kinetix Africa en payant l'abonnement en une fois.",
          ],
          "Voir mon espace",
        ).catch((err) =>
          console.error(
            `Email d'expiration de cagnotte non envoyé (${plan.id}) :`,
            err,
          ),
        );
      } catch (err) {
        console.error(`Clôture de la cagnotte ${plan.id} impossible :`, err);
      }
    }

    const soon = await db
      .select()
      .from(installmentPlans)
      .where(
        and(
          eq(installmentPlans.status, "OPEN"),
          isNull(installmentPlans.reminderSentAt),
          lt(
            installmentPlans.deadlineAt,
            new Date(Date.now() + INSTALLMENT_REMINDER_DAYS * 86_400_000),
          ),
        ),
      );
    for (const plan of soon) {
      if (!plan.deadlineAt) continue;
      try {
        await (plan.split
          ? emailMember(
              plan.userId,
              "Ton abonnement Kinetix Africa : il reste à régler",
              [
                `Tu as payé <strong>${fmt(plan.paidAmount)}</strong> sur ${fmt(plan.targetAmount)}. Il te reste <strong>${fmt(plan.targetAmount - plan.paidAmount)}</strong> à régler avant le <strong>${fmtDate(plan.deadlineAt)}</strong>.`,
                "Passé cette date, l'accès à ton compte sera suspendu jusqu'au règlement du solde.",
              ],
              "Régler mon solde",
            )
          : emailMember(
              plan.userId,
              "Ta cagnotte Kinetix Africa : plus que quelques jours",
              [
                `Tu as versé <strong>${fmt(plan.paidAmount)}</strong> sur ${fmt(plan.targetAmount)}. Il te reste <strong>${fmt(plan.targetAmount - plan.paidAmount)}</strong> à verser avant le <strong>${fmtDate(plan.deadlineAt)}</strong> pour activer ton abonnement.`,
                `Passé cette date, la cagnotte sera clôturée et remboursée, moins les frais de retrait.`,
              ],
              "Compléter ma cagnotte",
            ));
        await db
          .update(installmentPlans)
          .set({ reminderSentAt: new Date() })
          .where(eq(installmentPlans.id, plan.id));
        reminded += 1;
      } catch (err) {
        console.error(`Rappel de cagnotte non envoyé (${plan.id}) :`, err);
      }
    }
  } catch (err) {
    console.error("Traitement des cagnottes impossible :", err);
  }
  return { expired, reminded };
}

// For the admin: plans in progress and expired ones (refunded or not),
// with the member's name.
export async function listInstallmentPlansForAdmin() {
  const rows = await db
    .select({
      plan: installmentPlans,
      fullName: profiles.fullName,
      username: profiles.username,
    })
    .from(installmentPlans)
    .innerJoin(profiles, eq(profiles.id, installmentPlans.userId))
    .where(inArray(installmentPlans.status, ["OPEN", "EXPIRED"]))
    .orderBy(desc(installmentPlans.createdAt));
  return rows;
}

// The admin sent the refund by mobile money: recorded, and in the audit log.
export async function markInstallmentRefunded(
  adminUserId: string,
  planId: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut enregistrer un remboursement.",
      );
    }
    const [plan] = await tx
      .update(installmentPlans)
      .set({ refundedAt: new Date(), refundedByAdminId: adminUserId })
      .where(
        and(
          eq(installmentPlans.id, planId),
          eq(installmentPlans.status, "EXPIRED"),
          isNull(installmentPlans.refundedAt),
        ),
      )
      .returning();
    if (!plan) {
      throw new Error(
        "Cette cagnotte n'est pas à rembourser (déjà remboursée ?).",
      );
    }
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "INSTALLMENT_REFUNDED",
      targetType: "installment_plan",
      targetId: plan.id,
      metadata: {
        userId: plan.userId,
        refundAmount: plan.refundAmount,
        refundFee: plan.refundFee,
      },
    });
    return plan;
  });
}
