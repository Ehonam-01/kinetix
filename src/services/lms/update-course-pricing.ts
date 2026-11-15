import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";
import { assertMaxLength, SHORT_TEXT_MAX } from "@/services/admin/input-limits";

// price and category are display-only — see create-course.ts's comment for
// why price is no longer a real charge. salePrice is: what the course costs
// bought on its own, for life (explicit user decision); null, it isn't sold
// on its own. null clears a field (the form sends null for an emptied
// input, distinct from omitting the key, which drizzle would otherwise
// leave untouched).
export async function updateCoursePricing(
  adminUserId: string,
  courseId: string,
  input: {
    price: number | null;
    salePrice: number | null;
    category: string | null;
  },
) {
  assertMaxLength(input.category, SHORT_TEXT_MAX, "Catégorie");
  for (const [value, label] of [
    [input.price, "Le prix affiché"],
    [input.salePrice, "Le prix à l'unité"],
  ] as const) {
    if (
      value !== null &&
      (!Number.isInteger(value) || value < 0 || value > 10_000_000)
    ) {
      throw new Error(`${label} doit être un nombre entier positif.`);
    }
  }
  // Mobile Money charges nothing under this.
  if (input.salePrice !== null && input.salePrice < 100) {
    throw new Error("Le prix à l'unité est d'au moins 100 F.");
  }
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
      .set({
        price: input.price,
        salePrice: input.salePrice,
        category: input.category,
      })
      .where(eq(courses.id, courseId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COURSE_PRICING_UPDATED",
      targetType: "course",
      targetId: course.id,
      metadata: {
        price: input.price,
        salePrice: input.salePrice,
        category: input.category,
      },
    });

    return course;
  });
}
