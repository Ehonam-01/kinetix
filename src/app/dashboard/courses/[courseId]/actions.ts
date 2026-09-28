"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMember } from "@/services/auth/current-user";
import { markLessonComplete } from "@/services/lms/mark-lesson-complete";

export async function markLessonCompleteAction(
  courseId: string,
  lessonId: string,
) {
  const { profile } = await requireActiveMember();
  await markLessonComplete(profile.id, lessonId);
  revalidatePath(`/dashboard/courses/${courseId}`);
  revalidatePath("/dashboard/courses");
}
