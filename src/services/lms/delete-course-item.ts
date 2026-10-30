import "server-only";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { lessons, modules } from "@/db/schema/courses";
import { lessonPosts } from "@/db/schema/lesson-discussions";
import { lessonProgress } from "@/db/schema/lesson-progress";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

// Permanent, unlike the "Actif" checkbox (which only hides): ON DELETE
// CASCADE takes a lesson's quiz, quiz attempts, member progress and
// discussion with it, and a module its lessons. What went is counted in the
// audit log, since nothing else keeps a trace of it.

async function assertAdmin(tx: Executor, adminUserId: string) {
  const admin = await tx.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut supprimer du contenu.");
  }
}

async function countMemberData(tx: Executor, lessonIds: string[]) {
  if (lessonIds.length === 0) return { completions: 0, posts: 0 };
  const [completions] = await tx
    .select({ value: count() })
    .from(lessonProgress)
    .where(inArray(lessonProgress.lessonId, lessonIds));
  const [posts] = await tx
    .select({ value: count() })
    .from(lessonPosts)
    .where(inArray(lessonPosts.lessonId, lessonIds));
  return { completions: completions.value, posts: posts.value };
}

export async function deleteLesson(adminUserId: string, lessonId: string) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const lesson = await tx.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });
    if (!lesson) throw new Error("Leçon introuvable.");

    const removed = await countMemberData(tx, [lessonId]);
    await tx.delete(lessons).where(eq(lessons.id, lessonId));

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_DELETED",
      targetType: "lesson",
      targetId: lessonId,
      metadata: { title: lesson.title, moduleId: lesson.moduleId, ...removed },
    });
  });
}

export async function deleteModule(adminUserId: string, moduleId: string) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const target = await tx.query.modules.findFirst({
      where: eq(modules.id, moduleId),
    });
    if (!target) throw new Error("Module introuvable.");

    const moduleLessons = await tx.query.lessons.findMany({
      where: eq(lessons.moduleId, moduleId),
    });
    const removed = await countMemberData(
      tx,
      moduleLessons.map((l) => l.id),
    );
    await tx.delete(modules).where(eq(modules.id, moduleId));

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "MODULE_DELETED",
      targetType: "module",
      targetId: moduleId,
      metadata: {
        title: target.title,
        courseId: target.courseId,
        lessons: moduleLessons.map((l) => l.title),
        ...removed,
      },
    });
  });
}
