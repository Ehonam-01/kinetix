import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { generationProgress } from "@/db/schema/generation-progress";
import { levels, type LevelConfig } from "@/db/schema/levels";
import { memberLevels } from "@/db/schema/member-levels";
import { profiles } from "@/db/schema/profiles";
import {
  findAncestors,
  findBinaryNodeByUserId,
  findDescendantsAtDepths,
} from "@/repositories/binary-nodes";
import {
  computeGenerationCommission,
  getEffectiveGenerationRule,
  isGenerationQualified,
} from "@/repositories/commission-rules";
import {
  getCurrentParameterValue,
  getCurrentParameterValueOrNull,
} from "@/repositories/parameter-versions";
import { createCommissionEvent } from "./commission";
import { levelCommissionDedupeKey } from "./dedupe-keys";
import { unlockReward } from "./reward";

// Batch-checks which of the given candidate users already have a
// member_levels row for levelCode — one query via inArray(), not N+1, and
// not the = ANY(array) pitfall found in Phase 3 (a plain JS array works
// fine with Drizzle's query-builder inArray, unlike raw sql`= ANY(...)`).
async function filterAlreadyUnlocked(
  executor: Executor,
  levelCode: number,
  candidateUserIds: string[],
): Promise<Set<string>> {
  if (candidateUserIds.length === 0) return new Set();
  const rows = await executor.query.memberLevels.findMany({
    where: and(
      eq(memberLevels.levelCode, levelCode),
      inArray(memberLevels.userId, candidateUserIds),
    ),
  });
  return new Set(rows.map((r) => r.userId));
}

type GenerationProgressRow = typeof generationProgress.$inferSelect;

// The real qualification/completion check (section 14/17 of the master
// prompt) — called after EITHER kind of increment below, since either one
// alone can be what finally crosses the bar: currentCount from someone
// reaching the level (incrementGeneration), or bvTotal from a sale
// propagating up the tree (incrementGenerationBv,
// services/mlm/propagate-sale-volume.ts). No commission_rules row for this
// (levelCode, generation) yet -> the exact pre-Phase-11 behaviour
// (currentCount >= requiredCount, flat parameter_versions rate,
// LEVEL_COMMISSION) is preserved unchanged. A configured rule replaces both
// the qualification gate and the amount calculation, and is recorded under
// the newer GENERATION type instead — a real, queryable distinction
// between "paid under the old flat-rate system" and "paid under the new
// configurable one".
//
// The UPDATE ... WHERE status = 'PENDING' is the atomic guard: two
// increments racing to complete the same row (one from headcount, one from
// BV, or two concurrent sales) can only ever have one winner.
async function maybeCompleteGeneration(
  tx: Executor,
  row: GenerationProgressRow,
) {
  if (row.status !== "PENDING") return;

  const rule = await getEffectiveGenerationRule(tx, {
    levelCode: row.levelCode,
    generation: row.generation,
  });
  if (!isGenerationQualified(rule?.qualificationRequirement, row)) {
    return;
  }

  const [completed] = await tx
    .update(generationProgress)
    .set({ status: "COMPLETED", completedAt: sql`now()` })
    .where(
      and(
        eq(generationProgress.id, row.id),
        eq(generationProgress.status, "PENDING"),
      ),
    )
    .returning();
  if (!completed) return;

  if (row.levelCode !== 1) {
    if (rule) {
      // Both fetched unconditionally rather than branching on
      // rule.commissionType first — a generation completion is rare enough
      // that one extra parameter lookup is free, and it keeps this
      // straight-line instead of duplicating the createCommissionEvent call
      // below per commissionType.
      const [bvValueInCfa, subscriptionPriceInCfa] = await Promise.all([
        getCurrentParameterValue(tx, "bv.value_in_cfa"),
        getCurrentParameterValue(tx, "subscription.price_in_cfa"),
      ]);
      const amount = computeGenerationCommission(rule, {
        bvTotal: row.bvTotal,
        requiredCount: row.requiredCount,
        bvValueInCfa,
        subscriptionPriceInCfa,
      });
      if (amount > 0) {
        await createCommissionEvent(tx, {
          beneficiaryUserId: row.userId,
          type: "GENERATION",
          levelCode: row.levelCode,
          generation: row.generation,
          amount,
          dedupeKey: levelCommissionDedupeKey(
            row.userId,
            row.levelCode,
            row.generation,
          ),
          metadata: { commissionRuleId: rule.id },
        });
      }
    } else {
      // No commission_rules row for this (level, generation) — fall back
      // to the pre-Phase-11 flat parameter, but only if an admin actually
      // still has one configured. Migration 0031 deleted the seeded
      // defaults on the assumption every (level, generation) pair would
      // already have a commission_rules row in production; where that
      // assumption doesn't hold (a fresh environment, or a pair nobody's
      // configured yet), this must degrade the same way the DIRECT_SALE
      // path already does when unconfigured (confirm-subscription-payment.ts:
      // "if (rule) { ...pay... }", silently no commission otherwise) —
      // never throw and abort the member's own join/subscription
      // transaction over an admin configuration gap that isn't their fault.
      const rate = await getCurrentParameterValueOrNull(
        tx,
        `commission.level.${row.levelCode}`,
      );
      if (rate !== null) {
        await createCommissionEvent(tx, {
          beneficiaryUserId: row.userId,
          type: "LEVEL_COMMISSION",
          levelCode: row.levelCode,
          generation: row.generation,
          amount: rate * row.requiredCount,
          dedupeKey: levelCommissionDedupeKey(
            row.userId,
            row.levelCode,
            row.generation,
          ),
        });
      }
    }
  }

  const allGenerations = await tx.query.generationProgress.findMany({
    where: and(
      eq(generationProgress.userId, row.userId),
      eq(generationProgress.levelCode, row.levelCode),
    ),
  });
  const stillPending = allGenerations.some(
    (g) => g.id !== row.id && g.status !== "COMPLETED",
  );
  if (!stillPending) {
    await completeLevel(tx, row.userId, row.levelCode);
  }
}

// Increments one (beneficiary, level, generation) headcount — the
// rattrapage/propagation trigger, unchanged since Phase 4. Completion
// itself is now delegated to maybeCompleteGeneration, shared with the BV
// path below.
async function incrementGeneration(
  tx: Executor,
  userId: string,
  levelCode: number,
  generation: number,
) {
  const [row] = await tx
    .update(generationProgress)
    .set({ currentCount: sql`${generationProgress.currentCount} + 1` })
    .where(
      and(
        eq(generationProgress.userId, userId),
        eq(generationProgress.levelCode, levelCode),
        eq(generationProgress.generation, generation),
      ),
    )
    .returning();

  if (!row) return;
  await maybeCompleteGeneration(tx, row);
}

// The BV counterpart, called by services/mlm/propagate-sale-volume.ts when
// a confirmed sale's Business Volume propagates up an attributed
// ambassador's ancestor chain. Deliberately forward-only: a generation
// unlocked after a descendant already generated BV does not retroactively
// backfill that historical volume (no "rattrapage" for BV, unlike
// headcount) — a simplification worth reconsidering if the business needs
// it, not a silent gap (see ARCHITECTURE.md).
export async function incrementGenerationBv(
  tx: Executor,
  userId: string,
  levelCode: number,
  generation: number,
  bvAmount: number,
) {
  const [row] = await tx
    .update(generationProgress)
    .set({ bvTotal: sql`${generationProgress.bvTotal} + ${bvAmount}` })
    .where(
      and(
        eq(generationProgress.userId, userId),
        eq(generationProgress.levelCode, levelCode),
        eq(generationProgress.generation, generation),
      ),
    )
    .returning();

  if (!row) return;
  await maybeCompleteGeneration(tx, row);
}

async function completeLevel(tx: Executor, userId: string, levelCode: number) {
  await tx
    .update(memberLevels)
    .set({ status: "COMPLETED", completedAt: sql`now()` })
    .where(
      and(
        eq(memberLevels.userId, userId),
        eq(memberLevels.levelCode, levelCode),
      ),
    );

  if (levelCode >= 3) {
    await unlockReward(tx, userId, levelCode);
  }

  if (levelCode < 5) {
    await unlockLevel(tx, userId, levelCode + 1);
  } else {
    // The top of the compensation plan — this member becomes an "ancêtre"
    // (see createCommissionEvent, the only place that reads this column).
    // isNull guard keeps this a true one-time transition even if
    // completeLevel were ever invoked again for level 5 for this user.
    await tx
      .update(profiles)
      .set({ becameAncestorAt: sql`now()` })
      .where(and(eq(profiles.id, userId), isNull(profiles.becameAncestorAt)));
  }
}

// The single trigger validated in the architecture report: called every
// time a member unlocks a level (level 1 right after binary placement,
// levels 2-5 when completeLevel cascades into the next one). Idempotent —
// calling it again for a level the member already has is a no-op.
export async function unlockLevel(
  tx: Executor,
  userId: string,
  levelCode: number,
) {
  const existing = await tx.query.memberLevels.findFirst({
    where: and(
      eq(memberLevels.userId, userId),
      eq(memberLevels.levelCode, levelCode),
    ),
  });
  if (existing) return existing;

  if (levelCode > 1) {
    const previous = await tx.query.memberLevels.findFirst({
      where: and(
        eq(memberLevels.userId, userId),
        eq(memberLevels.levelCode, levelCode - 1),
      ),
    });
    if (previous?.status !== "COMPLETED") {
      throw new Error(
        `Le niveau ${levelCode - 1} doit être complété avant de débloquer le niveau ${levelCode}.`,
      );
    }
  }

  const level = await tx.query.levels.findFirst({
    where: eq(levels.code, levelCode),
  });
  if (!level) {
    throw new Error(`Niveau inconnu : ${levelCode}`);
  }

  const [memberLevel] = await tx
    .insert(memberLevels)
    .values({ userId, levelCode })
    .returning();

  const sizes = (level.config as LevelConfig).generationSizes;
  const gens = sizes.map((_, index) => index + 1);
  await tx.insert(generationProgress).values(
    sizes.map((size, index) => ({
      userId,
      levelCode,
      generation: index + 1,
      requiredCount: size,
    })),
  );

  const node = await findBinaryNodeByUserId(tx, userId);
  if (!node) {
    throw new Error(
      "Ce membre n'a pas encore de position dans l'arbre binaire.",
    );
  }

  // (a) Rattrapage — some of this member's fixed descendant positions may
  // have already unlocked this level before this member did.
  const descendants = await findDescendantsAtDepths(tx, node.path, gens);
  if (descendants.length > 0) {
    const qualified = await filterAlreadyUnlocked(
      tx,
      levelCode,
      descendants.map((d) => d.userId),
    );
    for (const d of descendants) {
      if (qualified.has(d.userId)) {
        await incrementGeneration(tx, userId, levelCode, d.relativeGeneration);
      }
    }
  }

  // (b) Propagation — this member just qualified; some of their fixed
  // ancestors (up to 3 generations up) may already have this level
  // unlocked and are waiting to count this member in.
  const ancestors = await findAncestors(tx, node.path, 3);
  const relevantAncestors = ancestors.filter((a) =>
    gens.includes(a.relativeGeneration),
  );
  if (relevantAncestors.length > 0) {
    const qualified = await filterAlreadyUnlocked(
      tx,
      levelCode,
      relevantAncestors.map((a) => a.userId),
    );
    for (const a of relevantAncestors) {
      if (qualified.has(a.userId)) {
        await incrementGeneration(
          tx,
          a.userId,
          levelCode,
          a.relativeGeneration,
        );
      }
    }
  }

  return memberLevel;
}

// Convenience wrapper for the entry point (level 1, called once a member
// has just been placed in the binary tree) — wraps everything in its own
// transaction when the caller doesn't already have one open.
export async function unlockFirstLevel(userId: string) {
  return db.transaction((tx) => unlockLevel(tx, userId, 1));
}
