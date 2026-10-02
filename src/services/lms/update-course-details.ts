import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";
import {
  assertMaxLength,
  LONG_TEXT_MAX,
  SHORT_TEXT_MAX,
} from "@/services/admin/input-limits";

// Title and description of a course. The slug (the public /formations/...
// address) is deliberately left as it was: renaming a course must not
// break links already shared or indexed.
export async function updateCourseDetails(
  adminUserId: string,
  courseId: string,
  input: { title: string; description: string | null },
) {
  const title = input.title.trim();
  const description = input.description?.trim() || null;
  if (!title) throw new Error("Le titre ne peut pas être vide.");
  assertMaxLength(title, SHORT_TEXT_MAX, "Titre");
  assertMaxLength(description, LONG_TEXT_MAX, "Description");

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un cours.");
    }

    const [course] = await tx
      .update(courses)
      .set({ title, description })
      .where(eq(courses.id, courseId))
      .returning();
    if (!course) throw new Error("Cours introuvable.");

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_DETAILS_UPDATED",
      targetType: "course",
      targetId: course.id,
      metadata: { title },
    });

    return course;
  });
}
