import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

// Display-only fields — see create-course.ts's comment for why price is no
// longer a real charge. null clears the field (the form sends null for an
// emptied input, distinct from omitting the key, which drizzle would
// otherwise leave untouched).
export async function updateCoursePricing(
  adminUserId: string,
  courseId: string,
  input: { price: number | null; category: string | null },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un cours.");
    }

    const existing = await tx.query.courses.findFirst({
      where: eq(courses.id, courseId),
    });
    if (!existing) {
      throw new Error("Cours introuvable.");
    }

    const [course] = await tx
      .update(courses)
      .set({ price: input.price, category: input.category })
      .where(eq(courses.id, courseId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_PRICING_UPDATED",
      targetType: "course",
      targetId: course.id,
      metadata: { price: input.price, category: input.category },
    });

    return course;
  });
}
