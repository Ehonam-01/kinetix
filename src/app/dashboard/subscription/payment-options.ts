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
  ]);

  // Paying in several deposits: a first subscription only, never a renewal
  // (installmentIneligibility), through PayDunya
  // (services/subscriptions/installments.ts).
  const openPlan = latestPlan?.status === "OPEN" ? latestPlan : null;
  const installments =
    activeProvider === "PAYDUNYA" && !ineligibility
      ? {
          plan: openPlan
            ? {
                targetAmount: openPlan.targetAmount,
                paidAmount: openPlan.paidAmount,
                deadlineAt: openPlan.deadlineAt?.toISOString() ?? null,
              }
            : null,
          bounds: openPlan
            ? await depositBounds(db, openPlan)
            : { min: Math.min(1000, price), max: price },
          months: INSTALLMENT_MONTHS,
        }
      : undefined;

  return {
    price,
    activeProvider,
    installments,
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
