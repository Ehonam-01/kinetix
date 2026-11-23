import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";
import {
  normalizeSalesPage,
  type CourseSalesPage,
} from "@/lib/course-sales-page";

// The sales page of a course (preview video, what the learner will learn,
// who it is for, questions and answers) — display only, nothing charged.
export async function updateCourseSalesPage(
  adminUserId: string,
  courseId: string,
  input: CourseSalesPage,
) {
  const page = normalizeSalesPage(input);
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un cours.");
    }

    const [course] = await tx
      .update(courses)
      .set(page)
      .where(eq(courses.id, courseId))
      .returning({ id: courses.id });
    if (!course) throw new Error("Cours introuvable.");

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_SALES_PAGE_UPDATED",
      targetType: "course",
      targetId: course.id,
      metadata: {
        previewVideoUrl: page.previewVideoUrl,
        learningOutcomes: page.learningOutcomes.length,
        targetAudience: page.targetAudience.length,
        faq: page.faq.length,
      },
    });

    return course;
  });
}
