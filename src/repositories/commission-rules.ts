import "server-only";
import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import {
  commissionRules,
  type QualificationRequirement,
} from "@/db/schema/commission-rules";

export type EffectiveCommissionRule = typeof commissionRules.$inferSelect;

// Resolution order, most specific first: an exact course match, then a
// category match, then the global default (courseId AND category both
// null) — mirrors parameter_versions' "currently effective" query (see
// repositories/parameter-versions.ts), just picking the most specific of
// several currently-effective candidates in JS rather than a single key
// lookup, since more than one DIRECT_SALE rule can be effective at once
// (one per course/category, plus at most one default).
export async function getEffectiveDirectSaleRule(
  executor: Executor,
  input: { courseId: string; category: string | null },
): Promise<EffectiveCommissionRule | null> {
  const candidates = await executor.query.commissionRules.findMany({
    where: and(
      eq(commissionRules.scope, "DIRECT_SALE"),
      lte(commissionRules.effectiveFrom, sql`now()`),
      or(
        isNull(commissionRules.effectiveTo),
        sql`${commissionRules.effectiveTo} > now()`,
      ),
    ),
    orderBy: desc(commissionRules.effectiveFrom),
  });

  const byCourse = candidates.find((r) => r.courseId === input.courseId);
  if (byCourse) return byCourse;

  if (input.category) {
    const byCategory = candidates.find(
      (r) => r.courseId === null && r.category === input.category,
    );
    if (byCategory) return byCategory;
  }

  return (
    candidates.find((r) => r.courseId === null && r.category === null) ?? null
  );
}

// Admin listing (admin/commission-rules/page.tsx) — every currently
// effective DIRECT_SALE rule, most recently created first. Small, fixed
// set in practice (one per course/category plus at most one default), so a
// single findMany + in-memory filter is simpler than per-scope queries.
export async function listEffectiveDirectSaleRules(
  executor: Executor,
): Promise<EffectiveCommissionRule[]> {
  return executor.query.commissionRules.findMany({
    where: and(
      eq(commissionRules.scope, "DIRECT_SALE"),
      lte(commissionRules.effectiveFrom, sql`now()`),
      or(
        isNull(commissionRules.effectiveTo),
        sql`${commissionRules.effectiveTo} > now()`,
      ),
    ),
    orderBy: desc(commissionRules.createdAt),
  });
}

// GENERATION scope is keyed by (levelCode, generation) exactly — no
// resolution-order ambiguity like DIRECT_SALE's course/category/default
// chain, since a generation only ever belongs to one level. Returns null
// when no admin has configured one yet — the caller
// (services/mlm/unlock-level.ts) falls back to the pre-Phase-11 flat-rate
// behaviour in that case, unchanged.
export async function getEffectiveGenerationRule(
  executor: Executor,
  input: { levelCode: number; generation: number },
): Promise<EffectiveCommissionRule | null> {
  const rule = await executor.query.commissionRules.findFirst({
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
    orderBy: desc(commissionRules.effectiveFrom),
  });
  return rule ?? null;
}

export async function listEffectiveGenerationRules(
  executor: Executor,
): Promise<EffectiveCommissionRule[]> {
  return executor.query.commissionRules.findMany({
    where: and(
      eq(commissionRules.scope, "GENERATION"),
      lte(commissionRules.effectiveFrom, sql`now()`),
      or(
        isNull(commissionRules.effectiveTo),
        sql`${commissionRules.effectiveTo} > now()`,
      ),
    ),
    orderBy: [commissionRules.levelCode, commissionRules.generation],
  });
}

// A generation's real qualification (section 14/17 of the master prompt) —
// never just headcount once a rule actually configures something stricter.
// requirement is the rule's qualificationRequirement (null when no rule
// exists at all, or when one exists but leaves it unset): presence is
// required by default (backward-compatible with the pre-Phase-11 behaviour)
// unless minBv is set with presence left unset/false, in which case BV
// alone gates it. Both fields set means both must hold — "2 positions
// qualifiées ET un BV minimum", not just headcount inflated by low-value
// sales.
export function isGenerationQualified(
  requirement: QualificationRequirement | null | undefined,
  row: { currentCount: number; requiredCount: number; bvTotal: number },
): boolean {
  const presenceRequired = requirement?.presence ?? requirement?.minBv == null;
  const presenceOk = !presenceRequired || row.currentCount >= row.requiredCount;
  const bvOk = requirement?.minBv == null || row.bvTotal >= requirement.minBv;
  return presenceOk && bvOk;
}

// FIXED -> rate x requiredCount, same "per generation, scaled by its size"
// semantics as the pre-Phase-11 flat-rate calculation (MLM_RULES.md: "les
// niveaux 2 à 5 paient par génération complétée... taux × taille de la
// génération"). BV_PERCENTAGE -> rate/10000 of the generation's accumulated
// bvTotal, itself first converted to F CFA via bvValueInCfa (parameter_versions
// key bv.value_in_cfa, e.g. 1000 -> 1 BV point = 1000 F CFA) — bvTotal is a
// count of BV points, never assumed to already be an F CFA amount (section 7
// of the master prompt: price and BV are never interchangeable). PERCENTAGE
// has no natural meaning at generation scope (there is no single "price" to
// take a percentage of, unlike a single sale) — deliberately not offered for
// GENERATION-scope rules in the admin form.
export function computeGenerationCommission(
  rule: EffectiveCommissionRule,
  input: { bvTotal: number; requiredCount: number; bvValueInCfa: number },
): number {
  const amount =
    rule.commissionType === "FIXED"
      ? rule.rate * input.requiredCount
      : Math.floor((input.bvTotal * input.bvValueInCfa * rule.rate) / 10_000);
  return rule.cap != null ? Math.min(amount, rule.cap) : amount;
}

// FIXED -> rate is a plain F CFA amount, same unit as parameter_versions.value.
// PERCENTAGE -> rate/10000 of the price paid (rate is basis points, see
// db/schema/commission-rules.ts). BV_PERCENTAGE -> rate/10000 of the
// Business Volume converted to F CFA via bvValueInCfa, instead of the price
// — the two are deliberately different bases (section 7 of the master
// prompt: price and BV are never interchangeable). cap, when set, is an
// upper bound in F CFA regardless of commissionType. Math.floor throughout:
// no floats anywhere in this codebase (XOF has no subunit, see
// FINANCIAL_MODEL.md).
export function computeDirectSaleCommission(
  rule: EffectiveCommissionRule,
  input: { pricePaid: number; businessVolume: number; bvValueInCfa: number },
): number {
  let amount: number;
  switch (rule.commissionType) {
    case "FIXED":
      amount = rule.rate;
      break;
    case "PERCENTAGE":
      amount = Math.floor((input.pricePaid * rule.rate) / 10_000);
      break;
    case "BV_PERCENTAGE":
      amount = Math.floor(
        (input.businessVolume * input.bvValueInCfa * rule.rate) / 10_000,
      );
      break;
  }
  return rule.cap != null ? Math.min(amount, rule.cap) : amount;
}
