"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { findPaymentById } from "@/repositories/payments";
import { requireUser } from "@/services/auth/current-user";
import { REFERRAL_COOKIE_NAME } from "@/services/attribution/resolve-referral";
import { initiateSubscriptionPayment } from "@/services/subscriptions/initiate-subscription-payment";
import { requestSubscriptionWithWallet } from "@/services/subscriptions/request-subscription-wallet";
import { confirmSubscriptionWithWallet } from "@/services/subscriptions/confirm-subscription-wallet";
import { confirmWizallPayment } from "@/services/payments/paydunya";
import { getPaymentProviderByName } from "@/services/payments/provider-selector";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";

// {error}-return convention, same as every other action here: a payment
// provider rejecting the request (bad/placeholder credentials, a network
// hiccup, a provider outage) is a real, expected failure mode — left
// uncaught, it used to crash the whole page render instead of showing a
// message, since an uncaught Server Action error has no built-in inline
// handling on the caller's side (SubscribeButton). A null checkoutUrl on
// success (Bictorys'/PayDunya's direct-softpay path — the SMS/USSD push
// already went out) means don't redirect: it's a real success, just
// nothing to navigate to, so the {error: null} + confirmationMessage
// return is what the button shows instead. otp/address are PayDunya-only,
// required for specific operators only (services/payments/paydunya.ts).
export async function subscribeAction(
  country: string,
  operator: string,
  phone: string,
  otp?: string,
  address?: string,
) {
  const { authUser, profile } = await requireUser();
  if (!authUser.email) {
    return {
      error: "Aucun email associé à ce compte.",
      confirmationMessage: null,
      paymentId: null,
      pendingWizallConfirmation: null,
    };
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;

  let checkoutUrl: string | null;
  let confirmationMessage: string | undefined;
  let paymentId: string;
  let pendingWizallConfirmation: { transactionId: string } | undefined;
  try {
    const intent = await initiateSubscriptionPayment({
      buyerUserId: profile.id,
      email: authUser.email,
      fullName: profile.fullName,
      returnUrl: `${origin}/dashboard/subscription`,
      visitorToken,
      country,
      operator,
      phone,
      otp,
      address,
    });
    checkoutUrl = intent.checkoutUrl;
    confirmationMessage = intent.confirmationMessage;
    paymentId = intent.payment.id;
    pendingWizallConfirmation = intent.pendingWizallConfirmation;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
      confirmationMessage: null,
      paymentId: null,
      pendingWizallConfirmation: null,
    };
  }

  if (!checkoutUrl) {
    return {
      error: null,
      confirmationMessage: confirmationMessage ?? null,
      paymentId,
      pendingWizallConfirmation: pendingWizallConfirmation ?? null,
    };
  }
  redirect(checkoutUrl);
}

// PayDunya's Wizall Money (Sénégal) only — the charge above only starts
// the transaction; the member gets an authorization code by SMS and must
// submit it here to actually complete it. Runs the same confirmation path
// a webhook/poll would (processWebhookEvent) once PayDunya accepts the
// code, since there's no separate "confirmed" signal to wait for
// afterwards — PayDunya's own confirm call IS the confirmation.
export async function confirmWizallPaymentAction(
  paymentId: string,
  transactionId: string,
  phone: string,
  authorizationCode: string,
) {
  const { profile } = await requireUser();
  const payment = await findPaymentById(db, paymentId);
  if (!payment || payment.beneficiaryUserId !== profile.id) {
    return { error: "Paiement introuvable." };
  }
  try {
    await confirmWizallPayment(transactionId, phone, authorizationCode);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }

  await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference: payment.providerReference ?? paymentId,
      status: "CONFIRMED",
      eventType: "wizall-manual-confirm",
      dedupeKey: `wizall-manual-confirm:${paymentId}`,
      raw: { transactionId },
    }),
  );

  return { error: null };
}

// Polled by SubscribeButton once it's showing the "check your phone"
// confirmation state (direct-softpay push sent, no page to redirect to) —
// there's no way to push the webhook's own confirmation straight to a
// specific open browser tab, so the client asks instead. Checks this exact
// payment's own status, not profile.status/getSubscriptionStatus: for a
// renewal the buyer is already ACTIVE before paying, so either of those
// would read as "confirmed" immediately and never actually wait for the
// webhook.
//
// Self-healing, not a passive read: if still PENDING here, actively
// re-verifies with the provider directly (same path as
// services/admin/reconcile-payment.ts) instead of only trusting that a
// webhook already updated this row — a webhook that never arrives (a
// misconfigured URL, an undocumented payload shape, ...) must never leave
// a real successful payment stuck waiting forever. Caught live in
// production twice already for exactly this reason.
export async function checkSubscriptionConfirmedAction(paymentId: string) {
  const { profile } = await requireUser();
  const payment = await findPaymentById(db, paymentId);
  if (!payment || payment.beneficiaryUserId !== profile.id) {
    throw new Error("Paiement introuvable.");
  }
  if (payment.status === "CONFIRMED") return true;
  if (payment.status !== "PENDING") return false;
  if (!payment.provider || !payment.providerReference) return false;

  const provider = getPaymentProviderByName(payment.provider);
  const verified = await provider.verifyPayment(payment.providerReference);
  if (verified.status !== "CONFIRMED") return false;

  await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference: verified.providerReference,
      status: verified.status,
      eventType: "poll-reconcile",
      dedupeKey: `poll-reconcile:${payment.id}:${verified.status}`,
      raw: verified,
    }),
  );
  return true;
}

// {error}-return convention, same as dashboard/transfer/actions.ts: a bad
// pseudo, an insufficient balance or a wrong OTP code are expected outcomes
// of this 2-step flow the form needs to show inline, not exceptional bugs.
export async function requestWalletSubscriptionAction(walletUsername: string) {
  const { profile } = await requireUser();
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;
  try {
    const request = await requestSubscriptionWithWallet({
      buyerUserId: profile.id,
      walletUsername,
      visitorToken,
    });
    return { requestId: request.id as string, error: null };
  } catch (err) {
    return {
      requestId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function confirmWalletSubscriptionAction(
  requestId: string,
  code: string,
) {
  const { profile } = await requireUser();
  try {
    await confirmSubscriptionWithWallet(profile.id, requestId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/dashboard/subscription");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard");
  // dashboard/layout.tsx reads subscription status to decide whether to
  // render the frozen screen instead of {children} — without invalidating
  // the layout itself, a member who just paid from that very screen (the
  // wallet path is embedded there) would keep seeing it, same staleness bug
  // fixed once already for the ambassador sidebar (become-ambassador/actions.ts).
  revalidatePath("/dashboard", "layout");
  return { error: null };
}
