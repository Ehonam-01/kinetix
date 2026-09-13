import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses, modules } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

// Position is assigned as (existing module count + 1) — fine at
// admin-authored, low-write volumes; no gap-safe sequencing needed.
export async function createModule(
  adminUserId: string,
  input: { courseId: string; title: string },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut créer un module.");
    }

    const course = await tx.query.courses.findFirst({
      where: eq(courses.id, input.courseId),
    });
    if (!course) {
      throw new Error("Cours introuvable.");
    }

    const existingModules = await tx.query.modules.findMany({
      where: eq(modules.courseId, input.courseId),
    });

    const [module] = await tx
      .insert(modules)
      .values({
        courseId: input.courseId,
        title: input.title,
        position: existingModules.length + 1,
      })
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "MODULE_CREATED",
      targetType: "module",
      targetId: module.id,
      metadata: { courseId: input.courseId, title: input.title },
    });

    return module;
  });
}
