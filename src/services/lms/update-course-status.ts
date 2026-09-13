import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses, courseStatusEnum } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

type CourseStatus = (typeof courseStatusEnum.enumValues)[number];

// The gate the AI-generation phase needs: a generated course lands as
// DRAFT and only reaches learners once an admin explicitly flips it here —
// nothing else in this codebase changes status today (createCourse always
// defaults to PUBLISHED per the schema default).
export async function updateCourseStatus(
  adminUserId: string,
  courseId: string,
  status: CourseStatus,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut publier un cours.");
    }

    const existing = await tx.query.courses.findFirst({
      where: eq(courses.id, courseId),
    });
    if (!existing) {
      throw new Error("Cours introuvable.");
    }

    const [course] = await tx
      .update(courses)
      .set({ status })
      .where(eq(courses.id, courseId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_STATUS_UPDATED",
      targetType: "course",
      targetId: course.id,
      metadata: { status },
    });

    return course;
  });
}
