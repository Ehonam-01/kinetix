import "server-only";
import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parameterVersions } from "@/db/schema/parameter-versions";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "./audit-log";

// Never updates a parameter_versions row in place (section 29/43,
// non-rétroactivité — see MLM_RULES.md): closes whatever row is currently
// effective (effective_to = now()) and inserts a new one starting at
// exactly that same instant, so there's never a gap or overlap between the
// two. A commission_event created a second before this call keeps
// snapshotting the old value forever.
export async function updateParameter(
  adminUserId: string,
  parameterKey: string,
  value: number,
) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("La valeur doit être un entier positif ou nul.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un paramètre.");
    }

    const current = await tx.query.parameterVersions.findFirst({
      where: and(
        eq(parameterVersions.parameterKey, parameterKey),
        lte(parameterVersions.effectiveFrom, sql`now()`),
        or(
          isNull(parameterVersions.effectiveTo),
          sql`${parameterVersions.effectiveTo} > now()`,
        ),
      ),
      orderBy: desc(parameterVersions.effectiveFrom),
    });

    let effectiveFrom: Date | undefined;
    if (current) {
      const [closed] = await tx
        .update(parameterVersions)
        .set({ effectiveTo: sql`now()` })
        .where(eq(parameterVersions.id, current.id))
        .returning();
      effectiveFrom = closed.effectiveTo ?? undefined;
    }

    const [newVersion] = await tx
      .insert(parameterVersions)
      .values({
        parameterKey,
        value,
        createdBy: adminUserId,
        ...(effectiveFrom ? { effectiveFrom } : {}),
      })
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "PARAMETER_UPDATED",
      targetType: "parameter",
      targetId: parameterKey,
      metadata: { previousValue: current?.value ?? null, newValue: value },
    });

    return newVersion;
  });
}
