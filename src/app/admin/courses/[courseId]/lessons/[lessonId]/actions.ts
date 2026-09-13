"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { saveQuiz, type QuizQuestionInput } from "@/services/lms/save-quiz";
import { updateLesson } from "@/services/lms/update-lesson";
import type { lessonTypeEnum, videoProviderEnum } from "@/db/schema/courses";

type VideoProvider = (typeof videoProviderEnum.enumValues)[number];
type LessonType = (typeof lessonTypeEnum.enumValues)[number];

export async function updateLessonAction(
  courseId: string,
  lessonId: string,
  input: {
    title: string;
    description?: string;
    lessonType: LessonType;
    videoProvider?: VideoProvider;
    videoUrl?: string;
    content?: string;
    isActive: boolean;
  },
) {
  const { profile } = await requireAdmin();
  try {
    await updateLesson(profile.id, lessonId, input);
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function saveQuizAction(
  courseId: string,
  lessonId: string,
  input: { passingScore: number; questions: QuizQuestionInput[] },
) {
  const { profile } = await requireAdmin();
  try {
    await saveQuiz(profile.id, lessonId, input);
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
