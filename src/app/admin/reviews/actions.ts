"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicCourses } from "@/lib/revalidate-public-courses";
import { requireAdmin } from "@/services/auth/current-user";
import { setCourseReviewHidden } from "@/services/lms/course-reviews";

export async function setCourseReviewHiddenAction(
  reviewId: string,
  hidden: boolean,
) {
  const { profile } = await requireAdmin();
  try {
    await setCourseReviewHidden(profile.id, reviewId, hidden);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/reviews");
  revalidatePath("/dashboard/courses", "layout");
  revalidatePublicCourses();
  return { error: null };
}
