import "server-only";
import { db } from "@/db/client";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import {
  getActiveProviderKey,
  getAlternativePaymentUrl,
  getSupportWhatsapp,
  isSaspayEnabled,
} from "@/repositories/payment-settings";
import { findRecentPendingPayment } from "@/repositories/payments";
import { isWorkshopDiscountOpen } from "@/services/workshops/discount";
import {
  getLaunchOffer,
  lastLaunchDayLabel,
} from "@/services/pricing/launch-offer";
import { splitPaymentChoices, splitTranches } from "@/lib/split-payment";
import {
  INSTALLMENT_MONTHS,
  depositBounds,
  getLatestInstallmentPlan,
  installmentIneligibility,
} from "@/services/subscriptions/installments";

// Everything a member is offered to pay their subscription with — shared
// by the subscription page and the "Finalisez votre inscription" screen a
// new member sees instead of the dashboard (frozen-account-screen.tsx), so
// the two can never drift apart: the active provider, "Autre pays"
// (SasPay), the installment plan, the support WhatsApp and the outside
// payment link.
export async function getPaymentOptions(userId: string) {
  const [
    price,
    activeProvider,
    pendingPayment,
    pendingDeposit,
    supportWhatsapp,
    alternativePaymentUrl,
    latestPlan,
    ineligibility,
    saspayEnabled,
    offer,
    workshopDiscount,
  ] = await Promise.all([
    getCurrentParameterValue(db, "subscription.price_in_cfa"),
    getActiveProviderKey(db),
    findRecentPendingPayment(db, userId, "SUBSCRIPTION"),
    findRecentPendingPayment(db, userId, "INSTALLMENT"),
    getSupportWhatsapp(db),
    getAlternativePaymentUrl(db),
    getLatestInstallmentPlan(db, userId),
    installmentIneligibility(db, userId),
    isSaspayEnabled(db),
    getLaunchOffer(db),
    isWorkshopDiscountOpen(db),
  ]);

  // Paying in several deposits: a first subscription only, never a renewal
  // (installmentIneligibility), through PayDunya
  // (services/subscriptions/installments.ts).
  const openPlan = latestPlan?.status === "OPEN" ? latestPlan : null;
  // A new plan is always a payment in 3 times (lib/split-payment.ts).
  const newPlanChoices = splitPaymentChoices(price, 0, 0);
  const installments =
    activeProvider === "PAYDUNYA" && !ineligibility
      ? {
          plan: openPlan
            ? {
                targetAmount: openPlan.targetAmount,
                paidAmount: openPlan.paidAmount,
                deadlineAt: openPlan.deadlineAt?.toISOString() ?? null,
                split: openPlan.split,
                overdue:
                  !!openPlan.deadlineAt &&
                  openPlan.deadlineAt.getTime() < Date.now(),
              }
            : null,
          bounds: openPlan
            ? await depositBounds(db, openPlan)
            : {
                min: newPlanChoices[0] ?? 0,
                max: newPlanChoices[0] ?? 0,
                choices: newPlanChoices,
              },
          months: INSTALLMENT_MONTHS,
          tranches: splitTranches(openPlan?.targetAmount ?? price),
        }
      : undefined;
  // Paying the rest of a payment in 3 times already started: that is all
  // this member can pay until it's settled.
  const settling =
    !!openPlan?.split && openPlan.paidAmount > 0 && !!installments;

  return {
    price,
    // The "tarif normal", shown struck through next to the price.
    regularPrice: offer.nextPrice,
    // The programmed end of the launch price, shown above the methods.
    launchOffer:
      offer.endsAt && offer.nextPrice
        ? {
            price,
            nextPrice: offer.nextPrice,
            endsAt: offer.endsAt,
            lastDayLabel: lastLaunchDayLabel(offer.endsAt),
            // Only a member still able to open a cagnotte.
            withInstallments: !!installments && !openPlan,
          }
        : null,
    activeProvider,
    installments,
    settling,
    workshopDiscount,
    // "Autre pays / carte bancaire": switched on by the admin, and SasPay
    // configured on the server.
    otherCountries: saspayEnabled && Boolean(process.env.SASPAY_SECRET_KEY),
    supportWhatsapp,
    alternativePaymentUrl,
    expiredPlan: latestPlan?.status === "EXPIRED" ? latestPlan : null,
    // A payment or deposit just started, whose confirmation is awaited.
    watchedPaymentId: (pendingPayment ?? pendingDeposit)?.id ?? null,
  };
}

export type PaymentOptions = Awaited<ReturnType<typeof getPaymentOptions>>;
