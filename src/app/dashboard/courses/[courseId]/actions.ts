"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMember } from "@/services/auth/current-user";
import { markLessonComplete } from "@/services/lms/mark-lesson-complete";
import {
  courseReviewSchema,
  deleteOwnCourseReview,
  saveCourseReview,
} from "@/services/lms/course-reviews";
import { revalidatePublicCourses } from "@/lib/revalidate-public-courses";

export async function markLessonCompleteAction(
  courseId: string,
  lessonId: string,
) {
  const { profile } = await requireActiveMember();
  await markLessonComplete(profile.id, lessonId);
  // "layout" also refreshes every lesson page under this course.
  revalidatePath(`/dashboard/courses/${courseId}`, "layout");
  revalidatePath("/dashboard/courses");
}

const failure = (err: unknown) => ({
  error: err instanceof Error ? err.message : "Une erreur est survenue.",
});

// The member's own rating and comment on the course
// (services/lms/course-reviews.ts).
export async function saveCourseReviewAction(
  courseId: string,
  input: { rating: number; comment: string },
) {
  const { profile } = await requireActiveMember();
  const parsed = courseReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  try {
    await saveCourseReview(profile.id, courseId, parsed.data);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/dashboard/courses/${courseId}`);
  revalidatePath("/dashboard/courses");
  revalidatePublicCourses();
  return { error: null };
}

export async function deleteCourseReviewAction(courseId: string) {
  const { profile } = await requireActiveMember();
  try {
    await deleteOwnCourseReview(profile.id, courseId);
  } catch (err) {
    return failure(err);
  }
  revalidatePath(`/dashboard/courses/${courseId}`);
  revalidatePath("/dashboard/courses");
  revalidatePublicCourses();
  return { error: null };
}
