import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { modules } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

export async function updateModule(
  adminUserId: string,
  moduleId: string,
  input: { title: string; isActive: boolean },
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un module.");
    }

    const existing = await tx.query.modules.findFirst({
      where: eq(modules.id, moduleId),
    });
    if (!existing) {
      throw new Error("Module introuvable.");
    }

    const [module] = await tx
      .update(modules)
      .set({ title: input.title, isActive: input.isActive })
      .where(eq(modules.id, moduleId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "MODULE_UPDATED",
      targetType: "module",
      targetId: module.id,
      metadata: { title: input.title },
    });

    return module;
  });
}
