import "server-only";
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

export type QuestionResult = {
  questionId: string;
  correct: boolean;
  correctOptionId: string;
};

// Scores a submitted attempt, records it (every attempt kept, never
// overwritten — see quizzes.ts), and on a pass also marks the lesson
// complete in the same transaction, so lesson_progress stays the single
// completion signal the rest of the app already reads (course %, "Terminée"
// badge) regardless of whether completion came from a click or a quiz.
export async function submitQuizAttempt(
  userId: string,
  lessonId: string,
  answers: Record<string, string>,
) {
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

    const questions = await findQuizQuestions(tx, quiz.id);
    const results: QuestionResult[] = questions.map((q) => {
      const correctOption = q.options.find((o) => o.isCorrect);
      return {
        questionId: q.id,
        correct: correctOption?.id === answers[q.id],
        correctOptionId: correctOption?.id ?? "",
      };
    });

    const correctCount = results.filter((r) => r.correct).length;
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

    return { score, passed, passingScore: quiz.passingScore, results };
  });
}
