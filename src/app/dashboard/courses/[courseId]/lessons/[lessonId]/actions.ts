"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMember } from "@/services/auth/current-user";
import { submitQuizAttempt } from "@/services/lms/submit-quiz-attempt";

export async function submitQuizAttemptAction(
  courseId: string,
  lessonId: string,
  answers: Record<string, string>,
) {
  const { profile } = await requireActiveMember();
  const result = await submitQuizAttempt(profile.id, lessonId, answers);
  if (result.passed) {
    // "layout" also refreshes every lesson page under this course — the
    // next lesson may just have been unlocked.
    revalidatePath(`/dashboard/courses/${courseId}`, "layout");
    revalidatePath("/dashboard/courses");
  }
  return result;
}
