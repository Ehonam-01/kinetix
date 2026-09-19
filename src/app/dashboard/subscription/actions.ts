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

// {error}-return convention, same as every other action here: a payment
// provider rejecting the request (bad/placeholder credentials, a network
// hiccup, Bictorys/Moneroo down) is a real, expected failure mode — left
// uncaught, it used to crash the whole page render instead of showing a
// message, since an uncaught Server Action error has no built-in inline
// handling on the caller's side (SubscribeButton). A null checkoutUrl on
// success (Bictorys' direct-softpay path — the SMS/USSD push already
// went out) means don't redirect: it's a real success, just nothing to
// navigate to, so the {error: null} + confirmationMessage return is what
// the button shows instead.
export async function subscribeAction(
  country: string,
  operator: string,
  phone: string,
) {
  const { authUser, profile } = await requireUser();
  if (!authUser.email) {
    return {
      error: "Aucun email associé à ce compte.",
      confirmationMessage: null,
      paymentId: null,
    };
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;

  let checkoutUrl: string | null;
  let confirmationMessage: string | undefined;
  let paymentId: string;
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
    });
    checkoutUrl = intent.checkoutUrl;
    confirmationMessage = intent.confirmationMessage;
    paymentId = intent.payment.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
      confirmationMessage: null,
      paymentId: null,
    };
  }

  if (!checkoutUrl) {
    return {
      error: null,
      confirmationMessage: confirmationMessage ?? null,
      paymentId,
    };
  }
  redirect(checkoutUrl);
}

// Polled by SubscribeButton once it's showing the "check your phone"
// confirmation state (direct-softpay push sent, no page to redirect to) —
// there's no way to push the webhook's own confirmation straight to a
// specific open browser tab, so the client asks instead. Checks this exact
// payment's own status, not profile.status/getSubscriptionStatus: for a
// renewal the buyer is already ACTIVE before paying, so either of those
// would read as "confirmed" immediately and never actually wait for the
// webhook.
export async function checkSubscriptionConfirmedAction(paymentId: string) {
  const { profile } = await requireUser();
  const payment = await findPaymentById(db, paymentId);
  if (!payment || payment.beneficiaryUserId !== profile.id) {
    throw new Error("Paiement introuvable.");
  }
  return payment.status === "CONFIRMED";
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
