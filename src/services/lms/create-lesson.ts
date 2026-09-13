import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  lessons,
  lessonTypeEnum,
  modules,
  videoProviderEnum,
} from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

type VideoProvider = (typeof videoProviderEnum.enumValues)[number];
type LessonType = (typeof lessonTypeEnum.enumValues)[number];

export async function createLesson(
  adminUserId: string,
  input: {
    moduleId: string;
    title: string;
    lessonType?: LessonType;
    description?: string;
    videoProvider?: VideoProvider;
    videoUrl?: string;
    content?: string;
  },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut créer une leçon.");
    }

    const targetModule = await tx.query.modules.findFirst({
      where: eq(modules.id, input.moduleId),
    });
    if (!targetModule) {
      throw new Error("Module introuvable.");
    }

    const lessonType = input.lessonType ?? "VIDEO";
    if (lessonType === "VIDEO" && !input.videoUrl) {
      throw new Error("Une leçon vidéo a besoin d'une URL de vidéo.");
    }

    const existingLessons = await tx.query.lessons.findMany({
      where: eq(lessons.moduleId, input.moduleId),
    });

    const [lesson] = await tx
      .insert(lessons)
      .values({
        moduleId: input.moduleId,
        title: input.title,
        description: input.description,
        lessonType,
        videoProvider:
          lessonType === "VIDEO" ? (input.videoProvider ?? "YOUTUBE") : null,
        videoUrl: lessonType === "VIDEO" ? input.videoUrl : null,
        content: lessonType === "TEXT" ? input.content : null,
        position: existingLessons.length + 1,
      })
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_CREATED",
      targetType: "lesson",
      targetId: lesson.id,
      metadata: { moduleId: input.moduleId, title: input.title, lessonType },
    });

    return lesson;
  });
}
