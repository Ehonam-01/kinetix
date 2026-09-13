"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { updateCoursePricing } from "@/services/lms/update-course-pricing";

export async function updateCoursePricingAction(
  courseId: string,
  input: { price: number; businessVolume: number; category?: string },
) {
  const { profile } = await requireAdmin();
  try {
    await updateCoursePricing(profile.id, courseId, input);
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath("/admin/courses");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
