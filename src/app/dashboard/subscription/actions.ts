"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { REFERRAL_COOKIE_NAME } from "@/services/attribution/resolve-referral";
import { initiateSubscriptionPayment } from "@/services/subscriptions/initiate-subscription-payment";
import { requestSubscriptionWithWallet } from "@/services/subscriptions/request-subscription-wallet";
import { confirmSubscriptionWithWallet } from "@/services/subscriptions/confirm-subscription-wallet";

export async function subscribeAction() {
  const { authUser, profile } = await requireUser();
  if (!authUser.email) {
    throw new Error("Aucun email associé à ce compte.");
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;

  const { checkoutUrl } = await initiateSubscriptionPayment({
    buyerUserId: profile.id,
    email: authUser.email,
    fullName: profile.fullName,
    returnUrl: `${origin}/dashboard/subscription`,
    visitorToken,
  });

  redirect(checkoutUrl);
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
