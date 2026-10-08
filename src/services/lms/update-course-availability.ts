import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

// "Disponible" / "Bientôt disponible": a coming-soon course stays listed
// everywhere, but members can't open it yet (repositories/courses.ts's
// hasCourseAccess).
export async function updateCourseAvailability(
  adminUserId: string,
  courseId: string,
  comingSoon: boolean,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un cours.");
    }
    const [course] = await tx
      .update(courses)
      .set({ comingSoon })
      .where(eq(courses.id, courseId))
      .returning();
    if (!course) throw new Error("Cours introuvable.");
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_AVAILABILITY_UPDATED",
      targetType: "course",
      targetId: course.id,
      metadata: { comingSoon },
    });
    return course;
  });
}
