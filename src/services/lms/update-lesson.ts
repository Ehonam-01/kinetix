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
import {
  assertMaxLength,
  LESSON_CONTENT_MAX,
  LONG_TEXT_MAX,
  SHORT_TEXT_MAX,
} from "@/services/admin/input-limits";

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
  assertMaxLength(input.title, SHORT_TEXT_MAX, "Titre de la leçon");
  assertMaxLength(input.description, LONG_TEXT_MAX, "Description");
  assertMaxLength(input.videoUrl, LONG_TEXT_MAX, "URL de la vidéo");
  assertMaxLength(input.content, LESSON_CONTENT_MAX, "Contenu de la leçon");
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

    // The video link may stay empty for now (see create-lesson.ts).
    const videoUrl = input.videoUrl?.trim() || null;

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
        videoUrl: input.lessonType === "VIDEO" ? videoUrl : null,
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
