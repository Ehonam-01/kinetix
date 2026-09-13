"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { REFERRAL_COOKIE_NAME } from "@/services/attribution/resolve-referral";
import { initiateCoursePurchase } from "@/services/sales/initiate-course-purchase";
import { requestCoursePurchaseWithWallet } from "@/services/sales/request-course-purchase-wallet";
import { confirmCoursePurchaseWithWallet } from "@/services/sales/confirm-course-purchase-wallet";

export async function purchaseCourseAction(courseId: string) {
  const { authUser, profile } = await requireUser();
  if (!authUser.email) {
    throw new Error("Aucun email associé à ce compte.");
  }

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;

  const { checkoutUrl } = await initiateCoursePurchase({
    buyerUserId: profile.id,
    courseId,
    email: authUser.email,
    fullName: profile.fullName,
    returnUrl: `${origin}/dashboard/courses/${courseId}`,
    visitorToken,
  });

  redirect(checkoutUrl);
}

// {error}-return convention, same as dashboard/transfer/actions.ts: a bad
// pseudo, an insufficient balance or a wrong OTP code are expected outcomes
// of this 2-step flow the form needs to show inline, not exceptional bugs.
export async function requestWalletPurchaseAction(
  courseId: string,
  walletUsername: string,
) {
  const { profile } = await requireUser();
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;
  try {
    const request = await requestCoursePurchaseWithWallet({
      buyerUserId: profile.id,
      courseId,
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

export async function confirmWalletPurchaseAction(
  courseId: string,
  requestId: string,
  code: string,
) {
  const { profile } = await requireUser();
  try {
    await confirmCoursePurchaseWithWallet(profile.id, requestId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath(`/dashboard/courses/${courseId}`);
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard");
  return { error: null };
}
