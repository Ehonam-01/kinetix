import "server-only";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { commissionRules } from "@/db/schema/commission-rules";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "./audit-log";

// Admin-only. Versioned the same way update-parameter.ts is (never updated
// in place — closes whatever is currently effective for this exact scoping
// key and inserts a new row starting at that same instant), just keyed by
// (courseId, category) instead of a single string key, since more than one
// DIRECT_SALE rule can be effective at once (repositories/commission-rules.ts
// resolves the most specific match at commission time).
export async function createDirectSaleCommissionRule(
  adminUserId: string,
  input: {
    courseId?: string;
    category?: string;
    commissionType: "FIXED" | "PERCENTAGE" | "BV_PERCENTAGE";
    rate: number;
    cap?: number;
  },
) {
  if (!Number.isInteger(input.rate) || input.rate < 0) {
    throw new Error("Le taux doit être un entier positif ou nul.");
  }
  if (input.cap != null && (!Number.isInteger(input.cap) || input.cap < 0)) {
    throw new Error("Le plafond doit être un entier positif ou nul.");
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

    const courseCondition = input.courseId
      ? eq(commissionRules.courseId, input.courseId)
      : isNull(commissionRules.courseId);
    const categoryCondition = input.category
      ? eq(commissionRules.category, input.category)
      : isNull(commissionRules.category);

    const current = await tx.query.commissionRules.findFirst({
      where: and(
        eq(commissionRules.scope, "DIRECT_SALE"),
        courseCondition,
        categoryCondition,
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
        scope: "DIRECT_SALE",
        courseId: input.courseId,
        category: input.category,
        commissionType: input.commissionType,
        rate: input.rate,
        cap: input.cap,
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
        scope: "DIRECT_SALE",
        courseId: input.courseId ?? null,
        category: input.category ?? null,
        commissionType: input.commissionType,
        rate: input.rate,
        cap: input.cap ?? null,
      },
    });

    return rule;
  });
}
