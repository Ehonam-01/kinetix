import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { quizAttempts, quizQuestions, quizzes } from "@/db/schema/quizzes";

export function findQuizByLessonId(executor: Executor, lessonId: string) {
  return executor.query.quizzes.findFirst({
    where: eq(quizzes.lessonId, lessonId),
  });
}

export function findQuizQuestions(executor: Executor, quizId: string) {
  return executor.query.quizQuestions.findMany({
    where: eq(quizQuestions.quizId, quizId),
    orderBy: asc(quizQuestions.position),
  });
}

// "Passed" is derived from attempt history (any passed=true row), same
// absence-means-not-done convention as lesson_progress — no separate status
// column to keep in sync.
export async function hasUserPassedQuiz(
  executor: Executor,
  userId: string,
  quizId: string,
) {
  const passedAttempt = await executor.query.quizAttempts.findFirst({
    where: and(
      eq(quizAttempts.userId, userId),
      eq(quizAttempts.quizId, quizId),
      eq(quizAttempts.passed, true),
    ),
  });
  return !!passedAttempt;
}

export function listQuizAttempts(
  executor: Executor,
  userId: string,
  quizId: string,
) {
  return executor.query.quizAttempts.findMany({
    where: and(
      eq(quizAttempts.userId, userId),
      eq(quizAttempts.quizId, quizId),
    ),
    orderBy: asc(quizAttempts.createdAt),
  });
}
