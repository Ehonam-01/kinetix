"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getTrustedOrigin } from "@/lib/trusted-origin";
import { db } from "@/db/client";
import { getPublicCourse } from "@/repositories/courses";
import { REFERRAL_COOKIE_NAME } from "@/services/attribution/resolve-referral";
import { requireUser } from "@/services/auth/current-user";
import { initiateCoursePurchase } from "@/services/lms/course-purchase";

// Buying one course on its own (services/lms/course-purchase.ts). Same
// return shape as dashboard/subscription/actions.ts's subscribeAction, so
// the same payment form drives it; which accounts may buy is checked by the
// service.
export async function buyCourseAction(
  courseId: string,
  country: string,
  operator: string,
  phone: string,
  otp?: string,
  address?: string,
) {
  const none = {
    confirmationMessage: null,
    paymentId: null,
    pendingWizallConfirmation: null,
  };
  const { authUser, profile } = await requireUser();
  // Each call pushes a USSD/SMS payment prompt to a phone number.
  if (await isRateLimited("paymentStart", `user:${profile.id}`)) {
    return { error: RATE_LIMIT_MESSAGE, ...none };
  }
  if (!authUser.email) {
    return { error: "Aucun email associé à ce compte.", ...none };
  }
  const content = await getPublicCourse(db, courseId);
  if (!content) return { error: "Formation introuvable.", ...none };
  const slug = content.course.slug ?? content.course.id;

  const origin = await getTrustedOrigin();
  const visitorToken = (await cookies()).get(REFERRAL_COOKIE_NAME)?.value;
  let intent: Awaited<ReturnType<typeof initiateCoursePurchase>>;
  try {
    intent = await initiateCoursePurchase({
      buyerUserId: profile.id,
      courseId: content.course.id,
      email: authUser.email,
      fullName: profile.fullName,
      returnUrl: `${origin}/formations/${slug}/acheter`,
      visitorToken,
      country,
      operator,
      phone,
      otp,
      address,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
      ...none,
    };
  }
  if (!intent.checkoutUrl) {
    return {
      error: null,
      confirmationMessage: intent.confirmationMessage ?? null,
      paymentId: intent.payment.id,
      pendingWizallConfirmation: intent.pendingWizallConfirmation ?? null,
    };
  }
  redirect(intent.checkoutUrl);
}
