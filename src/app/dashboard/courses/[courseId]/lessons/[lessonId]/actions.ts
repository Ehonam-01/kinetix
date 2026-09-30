"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMember } from "@/services/auth/current-user";
import { submitQuizAttempt } from "@/services/lms/submit-quiz-attempt";
import {
  deleteOwnLessonPost,
  postLessonAnswer,
  postLessonQuestion,
  reportLessonPost,
} from "@/services/lms/lesson-discussion";

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

function discussionResult(err: unknown) {
  return {
    error: err instanceof Error ? err.message : "Une erreur est survenue.",
  };
}

export async function postLessonQuestionAction(
  courseId: string,
  lessonId: string,
  body: string,
) {
  const { profile } = await requireActiveMember();
  try {
    await postLessonQuestion(profile.id, lessonId, body);
  } catch (err) {
    return discussionResult(err);
  }
  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
  return { error: null };
}

export async function postLessonAnswerAction(
  courseId: string,
  lessonId: string,
  questionId: string,
  body: string,
) {
  const { profile } = await requireActiveMember();
  try {
    await postLessonAnswer(profile.id, questionId, body);
  } catch (err) {
    return discussionResult(err);
  }
  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
  return { error: null };
}

export async function deleteLessonPostAction(
  courseId: string,
  lessonId: string,
  postId: string,
) {
  const { profile } = await requireActiveMember();
  try {
    await deleteOwnLessonPost(profile.id, postId);
  } catch (err) {
    return discussionResult(err);
  }
  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
  return { error: null };
}

export async function reportLessonPostAction(
  courseId: string,
  lessonId: string,
  postId: string,
  reason: string,
) {
  const { profile } = await requireActiveMember();
  try {
    await reportLessonPost(profile.id, postId, reason);
  } catch (err) {
    return discussionResult(err);
  }
  revalidatePath(`/dashboard/courses/${courseId}/lessons/${lessonId}`);
  return { error: null };
}
