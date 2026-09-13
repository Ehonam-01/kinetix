import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

// Admin-only. Deliberately narrow — price/businessVolume/category, not a
// general course editor (title/description already have no edit path
// either, unchanged in this phase) — this exists to make the education-
// first pivot's catalogue usable: an admin needs to be able to set a real
// price/BV on the one course that already existed before this pivot, and on
// every course created since (see create-course.ts). price/businessVolume
// are two distinct values (section 7 of the master prompt) — never
// derived from one another here.
export async function updateCoursePricing(
  adminUserId: string,
  courseId: string,
  input: { price: number; businessVolume: number; category?: string },
) {
  if (!Number.isInteger(input.price) || input.price < 0) {
    throw new Error("Le prix doit être un entier positif ou nul.");
  }
  if (!Number.isInteger(input.businessVolume) || input.businessVolume < 0) {
    throw new Error("Le Business Volume doit être un entier positif ou nul.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut modifier le prix d'une formation.",
      );
    }

    const [updated] = await tx
      .update(courses)
      .set({
        price: input.price,
        businessVolume: input.businessVolume,
        category: input.category,
      })
      .where(eq(courses.id, courseId))
      .returning();

    if (!updated) {
      throw new Error("Formation introuvable.");
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_PRICING_UPDATED",
      targetType: "course",
      targetId: courseId,
      metadata: {
        price: input.price,
        businessVolume: input.businessVolume,
        category: input.category ?? null,
      },
    });

    return updated;
  });
}
