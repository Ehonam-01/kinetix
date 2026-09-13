"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { submitQuizAttempt } from "@/services/lms/submit-quiz-attempt";

export async function submitQuizAttemptAction(
  courseId: string,
  lessonId: string,
  answers: Record<string, string>,
) {
  const { profile } = await requireUser();
  const result = await submitQuizAttempt(profile.id, lessonId, answers);
  if (result.passed) {
    revalidatePath(`/dashboard/courses/${courseId}`);
    revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
    revalidatePath("/dashboard/courses");
  }
  return result;
}
