import "server-only";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { commissionRules } from "@/db/schema/commission-rules";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "./audit-log";

// Admin-only. Versioned the same way create-direct-sale-rule.ts is, keyed
// by (levelCode, generation) instead of (courseId, category) — a
// generation only ever belongs to one level, so no resolution-order
// ambiguity exists here (repositories/commission-rules.ts's
// getEffectiveGenerationRule is a direct lookup, not a specificity chain).
export async function createGenerationCommissionRule(
  adminUserId: string,
  input: {
    levelCode: number;
    generation: number;
    commissionType: "FIXED" | "BV_PERCENTAGE";
    rate: number;
    cap?: number;
    requirePresence: boolean;
    minimumBv?: number;
  },
) {
  if (!Number.isInteger(input.rate) || input.rate < 0) {
    throw new Error("Le taux doit être un entier positif ou nul.");
  }
  if (input.cap != null && (!Number.isInteger(input.cap) || input.cap < 0)) {
    throw new Error("Le plafond doit être un entier positif ou nul.");
  }
  if (
    input.minimumBv != null &&
    (!Number.isInteger(input.minimumBv) || input.minimumBv < 0)
  ) {
    throw new Error("Le volume minimum doit être un entier positif ou nul.");
  }
  if (!input.requirePresence && input.minimumBv == null) {
    throw new Error(
      "La règle doit exiger au moins une condition : présence ou volume minimum.",
    );
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut créer une règle de commission.",
      );
    }

    const current = await tx.query.commissionRules.findFirst({
      where: and(
        eq(commissionRules.scope, "GENERATION"),
        eq(commissionRules.levelCode, input.levelCode),
        eq(commissionRules.generation, input.generation),
        lte(commissionRules.effectiveFrom, sql`now()`),
        or(
          isNull(commissionRules.effectiveTo),
          sql`${commissionRules.effectiveTo} > now()`,
        ),
      ),
    });

    let effectiveFrom: Date | undefined;
    if (current) {
      const [closed] = await tx
        .update(commissionRules)
        .set({ effectiveTo: sql`now()` })
        .where(eq(commissionRules.id, current.id))
        .returning();
      effectiveFrom = closed.effectiveTo ?? undefined;
    }

    const [rule] = await tx
      .insert(commissionRules)
      .values({
        scope: "GENERATION",
        levelCode: input.levelCode,
        generation: input.generation,
        commissionType: input.commissionType,
        rate: input.rate,
        cap: input.cap,
        minimumBv: input.minimumBv,
        qualificationRequirement: {
          presence: input.requirePresence,
          ...(input.minimumBv != null ? { minBv: input.minimumBv } : {}),
        },
        createdBy: adminUserId,
        ...(effectiveFrom ? { effectiveFrom } : {}),
      })
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "COMMISSION_RULE_CREATED",
      targetType: "commission_rule",
      targetId: rule.id,
      metadata: {
        scope: "GENERATION",
        levelCode: input.levelCode,
        generation: input.generation,
        commissionType: input.commissionType,
        rate: input.rate,
        cap: input.cap ?? null,
        requirePresence: input.requirePresence,
        minimumBv: input.minimumBv ?? null,
      },
    });

    return rule;
  });
}
