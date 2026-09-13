import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { lessonProgress } from "@/db/schema/lesson-progress";
import {
  findLessonById,
  findModuleById,
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
