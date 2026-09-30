import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { lessonProgress } from "@/db/schema/lesson-progress";
import {
  findLessonById,
  findModuleById,
  getCourseContent,
  hasCourseAccess,
} from "@/repositories/courses";

// Idempotent: marking an already-completed lesson again is a no-op, not an
// error (ON CONFLICT DO NOTHING on the unique (user_id, lesson_id)) — same
// convention as commission/reward idempotency. Access is re-checked here,
// not just assumed from the UI having shown the lesson.
export async function markLessonComplete(userId: string, lessonId: string) {
  return db.transaction(async (tx) => {
    const lesson = await findLessonById(tx, lessonId);
    if (!lesson || !lesson.isActive) {
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

    // Same gate as submit-quiz-attempt.ts: a locked lesson can't be
    // completed out of order, and a lesson with a quiz is only completed by
    // passing it — never by a direct call to this action.
    const content = await getCourseContent(tx, lessonModule.courseId, userId);
    const lessonView = content?.modules
      .flatMap((m) => m.lessons)
      .find((l) => l.id === lessonId);
    if (!lessonView || lessonView.locked) {
      throw new Error("Cette leçon est verrouillée.");
    }
    if (lessonView.hasQuiz && lesson.lessonType === "TEXT") {
      throw new Error("Réussis le quiz pour valider cette leçon.");
    }

    await tx
      .insert(lessonProgress)
      .values({ userId, lessonId })
      .onConflictDoNothing({
        target: [lessonProgress.userId, lessonProgress.lessonId],
      });

    return tx.query.lessonProgress.findFirst({
      where: and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId),
      ),
    });
  });
}
