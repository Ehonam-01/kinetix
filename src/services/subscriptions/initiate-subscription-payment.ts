import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { resolveAttribution } from "@/services/attribution/resolve-referral";
import { getActivePaymentProvider } from "@/services/payments/provider-selector";

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
  // Bictorys' direct-softpay mode (provider.ts's CreatePaymentInput) — all
  // three required together for it to actually reach the customer's phone;
  // Moneroo ignores them.
  country?: string;
  operator?: string;
  phone?: string;
}) {
  const amount = await getCurrentParameterValue(
    db,
    "subscription.price_in_cfa",
  );
  const attribution = await resolveAttribution(input.visitorToken);
  const idempotencyKey = `SUBSCRIPTION:${input.buyerUserId}:${randomUUID()}`;
  const { firstName, lastName } = splitFullName(input.fullName);
  const provider = await getActivePaymentProvider(db);

  const intent = await provider.createPayment({
    amount,
    description: "Abonnement annuel Kinetix Africa",
    customer: { email: input.email, firstName, lastName, phone: input.phone },
    returnUrl: input.returnUrl,
    idempotencyKey,
    metadata: { beneficiary_user_id: input.buyerUserId },
    operator: input.operator,
    country: input.country,
  });

  const [payment] = await db
    .insert(payments)
    .values({
      beneficiaryUserId: input.buyerUserId,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount,
      provider: provider.name,
      providerReference: intent.providerReference,
      idempotencyKey,
      status: "PENDING",
      // The only place confirm-subscription-payment.ts can recover the
      // attributed ambassador — payments has no ambassadorUserId column of
      // its own (it stays purpose-agnostic, shared with REGISTRATION and
      // the retired COURSE_PURCHASE).
      metadata: {
        ambassadorUserId: attribution?.ambassadorUserId ?? null,
        attributionId: attribution?.attributionId ?? null,
      },
    })
    .returning();

  return {
    payment,
    checkoutUrl: intent.checkoutUrl,
    confirmationMessage: intent.confirmationMessage,
  };
}
