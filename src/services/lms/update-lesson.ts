import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  lessons,
  lessonTypeEnum,
  videoProviderEnum,
} from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

type VideoProvider = (typeof videoProviderEnum.enumValues)[number];
type LessonType = (typeof lessonTypeEnum.enumValues)[number];

// The prerequisite the AI-generation phase needs: a VIDEO lesson the AI
// created with no real video yet (or any lesson at all) can now actually be
// edited — createLesson/createModule had no matching update before this.
export async function updateLesson(
  adminUserId: string,
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
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier une leçon.");
    }

    const existing = await tx.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });
    if (!existing) {
      throw new Error("Leçon introuvable.");
    }

    if (input.lessonType === "VIDEO" && !input.videoUrl) {
      throw new Error("Une leçon vidéo a besoin d'une URL de vidéo.");
    }

    const [lesson] = await tx
      .update(lessons)
      .set({
        title: input.title,
        description: input.description || null,
        lessonType: input.lessonType,
        // Loosened columns (Phase A) — clearing the field that doesn't
        // apply to the chosen type instead of leaving stale data behind
        // when an admin switches a lesson from VIDEO to TEXT or back.
        videoProvider:
          input.lessonType === "VIDEO"
            ? (input.videoProvider ?? "YOUTUBE")
            : null,
        videoUrl: input.lessonType === "VIDEO" ? input.videoUrl : null,
        content: input.lessonType === "TEXT" ? (input.content ?? null) : null,
        isActive: input.isActive,
      })
      .where(eq(lessons.id, lessonId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_UPDATED",
      targetType: "lesson",
      targetId: lesson.id,
      metadata: { title: input.title, lessonType: input.lessonType },
    });

    return lesson;
  });
}
