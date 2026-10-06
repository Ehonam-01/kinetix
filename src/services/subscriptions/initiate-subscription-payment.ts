import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { resolveSaleAttribution } from "@/services/attribution/resolve-referral";
import { getActivePaymentProvider } from "@/services/payments/provider-selector";
import { saspayProvider } from "@/services/payments/saspay";
import { OTHER_COUNTRY } from "@/config/paydunya-countries";

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: trimmed };
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1),
  };
}

// Entry point for buying the annual subscription by mobile money — the
// pendant of initiate-course-purchase.ts (retired by this same pivot) and
// initiate-registration-payment.ts, whose amount-from-parameter pattern this
// mirrors exactly: subscription.price_in_cfa, not a per-course price. No
// profile.status check here, deliberately — same reasoning as
// initiateRegistrationPayment: this is how a brand new PENDING_PAYMENT
// account gets its very first paid access, so it can't require ACTIVE
// already (unlike the wallet-funded path in request-subscription-wallet.ts,
// which does). Confirmation only ever happens later, via the signed webhook
// — this function never grants access itself.
export async function initiateSubscriptionPayment(input: {
  buyerUserId: string;
  email: string;
  fullName: string;
  returnUrl: string;
  visitorToken?: string;
  // Bictorys'/PayDunya's direct-softpay mode (provider.ts's
  // CreatePaymentInput) — country/operator/phone required together for it
  // to actually reach the customer's phone; Moneroo ignores all of them.
  // otp/address are PayDunya-only, required only for specific operators
  // (services/payments/paydunya.ts's operator table).
  country?: string;
  operator?: string;
  phone?: string;
  otp?: string;
  address?: string;
  // One deposit towards an installment plan (services/subscriptions/
  // installments.ts) instead of the full price: charged the same way, but
  // recorded as an INSTALLMENT payment, which never grants access itself.
  installment?: { planId: string; amount: number };
}) {
  const amount = input.installment
    ? input.installment.amount
    : await getCurrentParameterValue(db, "subscription.price_in_cfa");
  const attribution = input.installment
    ? null
    : await resolveSaleAttribution(input.buyerUserId, input.visitorToken);
  const idempotencyKey = `${input.installment ? "INSTALLMENT" : "SUBSCRIPTION"}:${input.buyerUserId}:${randomUUID()}`;
  const { firstName, lastName } = splitFullName(input.fullName);
  // "Mon pays n'est pas dans la liste" on the payment form: SasPay's hosted
  // checkout, where the member picks any country it covers, or a card.
  const provider =
    input.country === OTHER_COUNTRY
      ? saspayProvider
      : await getActivePaymentProvider(db);

  // Inserted before calling the provider, deliberately — providerReference
  // is filled in once createPayment returns, below. If that call throws
  // (network timeout, provider outage) after the provider has actually
  // accepted/processed the charge on their end regardless, this row is
  // what lets an admin find and manually reconcile it later (/admin/
  // payments). The reverse ordering left zero local trace of a real
  // charge whenever the two disagreed — caught live in production.
  const [pendingPayment] = await db
    .insert(payments)
    .values({
      beneficiaryUserId: input.buyerUserId,
      purpose: input.installment ? "INSTALLMENT" : "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount,
      provider: provider.name,
      idempotencyKey,
      status: "PENDING",
      // The only place confirm-subscription-payment.ts can recover the
      // attributed ambassador — payments has no ambassadorUserId column of
      // its own (it stays purpose-agnostic, shared with REGISTRATION and
      // the retired COURSE_PURCHASE).
      metadata: input.installment
        ? {
            installmentPlanId: input.installment.planId,
            // Where a refund would go if the plan expired unpaid.
            payout: {
              country: input.country ?? null,
              operator: input.operator ?? null,
              phone: input.phone ?? null,
            },
          }
        : {
            ambassadorUserId: attribution?.ambassadorUserId ?? null,
            attributionId: attribution?.attributionId ?? null,
          },
    })
    .returning();

  const intent = await provider.createPayment({
    amount,
    description: input.installment
      ? "Versement — abonnement annuel Kinetix Africa"
      : "Abonnement annuel Kinetix Africa",
    customer: { email: input.email, firstName, lastName, phone: input.phone },
    returnUrl: input.returnUrl,
    idempotencyKey,
    metadata: { beneficiary_user_id: input.buyerUserId },
    operator: input.operator,
    country: input.country,
    otp: input.otp,
    address: input.address,
  });

  // PayDunya's Wizall Money only: the transaction id and phone the second
  // confirmation step needs are kept server-side, never taken back from
  // the browser — confirmWizallPaymentAction (dashboard/subscription/
  // actions.ts) reads them from here, so a client can't point one of its
  // own payments at some other (already-confirmed) Wizall transaction.
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
