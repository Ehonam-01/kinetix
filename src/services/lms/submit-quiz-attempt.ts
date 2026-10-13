import "server-only";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { lessonProgress } from "@/db/schema/lesson-progress";
import { quizAttempts } from "@/db/schema/quizzes";
import {
  findLessonById,
  findModuleById,
  getCourseContent,
  hasCourseAccess,
} from "@/repositories/courses";
import { findQuizByLessonId, findQuizQuestions } from "@/repositories/quizzes";

const quizAnswersSchema = z
  .record(z.string().uuid(), z.string().uuid())
  .refine((answers) => Object.keys(answers).length <= 200, {
    message: "Trop de réponses.",
  });

// Answering at random until the quiz passes used to be free: every attempt
// sent back the right option of each question, with no limit (security
// audit SEC-11). Now at most QUIZ_MAX_FAILED_ATTEMPTS failed attempts per
// quiz within QUIZ_ATTEMPT_WINDOW_MINUTES, and the right options are only
// shown once the quiz is passed — a failed attempt says which questions
// were wrong, not what the answer was.
export const QUIZ_MAX_FAILED_ATTEMPTS = 3;
export const QUIZ_ATTEMPT_WINDOW_MINUTES = 60;

export type QuestionResult = {
  questionId: string;
  correct: boolean;
  // Only once passed; null on a failed attempt.
  correctOptionId: string | null;
};

export type QuizAttemptOutcome =
  | {
      limited: false;
      score: number;
      passed: boolean;
      passingScore: number;
      results: QuestionResult[];
      // Failed attempts still allowed in the current window.
      attemptsLeft: number;
    }
  | { limited: true; retryInMinutes: number; maxAttempts: number };

// Scores a submitted attempt, records it (every attempt kept, never
// overwritten — see quizzes.ts), and on a pass also marks the lesson
// complete in the same transaction, so lesson_progress stays the single
// completion signal the rest of the app already reads (course %, "Terminée"
// badge) regardless of whether completion came from a click or a quiz.
export async function submitQuizAttempt(
  userId: string,
  lessonId: string,
  rawAnswers: Record<string, string>,
): Promise<QuizAttemptOutcome> {
  // Stored as-is in quiz_attempts.answers — bounded to question/option ids
  // only, so a hand-crafted call can't persist an arbitrarily large payload
  // (security audit L5).
  const answers = quizAnswersSchema.parse(rawAnswers);

  return db.transaction(async (tx) => {
    const lesson = await findLessonById(tx, lessonId);
    if (!lesson || !lesson.isActive || lesson.lessonType !== "TEXT") {
      throw new Error("Leçon introuvable.");
    }

    const lessonModule = await findModuleById(tx, lesson.moduleId);
    if (!lessonModule || !lessonModule.isActive) {
      throw new Error("Leçon introuvable.");
    }

    const access = await hasCourseAccess(tx, userId, lessonModule.courseId);
    if (!access) {
      throw new Error("Vous n'avez pas accès à ce cours.");
    }

    // Re-derives locking from the same source of truth the course page
    // shows, so a learner can't bypass the gate by hitting this action
    // directly out of order.
    const content = await getCourseContent(tx, lessonModule.courseId, userId);
    const lessonView = content?.modules
      .flatMap((m) => m.lessons)
      .find((l) => l.id === lessonId);
    if (!lessonView || lessonView.locked) {
      throw new Error("Cette leçon est verrouillée.");
    }

    const quiz = await findQuizByLessonId(tx, lessonId);
    if (!quiz) {
      throw new Error("Cette leçon n'a pas de quiz.");
    }

    // One attempt at a time per member and quiz, so parallel submissions
    // can't all slip under the limit.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`quiz:${userId}:${quiz.id}`}))`,
    );
    const windowStart = sql`now() - make_interval(mins => ${QUIZ_ATTEMPT_WINDOW_MINUTES})`;
    const recentFailures = await tx
      .select({ createdAt: quizAttempts.createdAt })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.quizId, quiz.id),
          eq(quizAttempts.passed, false),
          gt(quizAttempts.createdAt, windowStart),
        ),
      )
      .orderBy(asc(quizAttempts.createdAt));
    if (recentFailures.length >= QUIZ_MAX_FAILED_ATTEMPTS) {
      const freedAt =
        recentFailures[0].createdAt.getTime() +
        QUIZ_ATTEMPT_WINDOW_MINUTES * 60 * 1000;
      return {
        limited: true,
        retryInMinutes: Math.max(1, Math.ceil((freedAt - Date.now()) / 60000)),
        maxAttempts: QUIZ_MAX_FAILED_ATTEMPTS,
      };
    }

    const questions = await findQuizQuestions(tx, quiz.id);
    const graded = questions.map((q) => {
      const correctOption = q.options.find((o) => o.isCorrect);
      return {
        questionId: q.id,
        correct: correctOption?.id === answers[q.id],
        correctOptionId: correctOption?.id ?? null,
      };
    });

    const correctCount = graded.filter((r) => r.correct).length;
    const score = questions.length
      ? Math.round((correctCount / questions.length) * 100)
      : 0;
    const passed = score >= quiz.passingScore;

    await tx.insert(quizAttempts).values({
      userId,
      quizId: quiz.id,
      score,
      passed,
      answers,
    });

    if (passed) {
      await tx
        .insert(lessonProgress)
        .values({ userId, lessonId })
        .onConflictDoNothing({
          target: [lessonProgress.userId, lessonProgress.lessonId],
        });
    }

    const results: QuestionResult[] = passed
      ? graded
      : graded.map((r) => ({ ...r, correctOptionId: null }));
    return {
      limited: false,
      score,
      passed,
      passingScore: quiz.passingScore,
      results,
      attemptsLeft: passed
        ? QUIZ_MAX_FAILED_ATTEMPTS
        : QUIZ_MAX_FAILED_ATTEMPTS - recentFailures.length - 1,
    };
  });
}
