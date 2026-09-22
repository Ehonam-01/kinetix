import "server-only";
import { asc } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { levels } from "@/db/schema/levels";
import {
  computeDirectSaleCommission,
  listEffectiveDirectSaleRules,
  listEffectiveGenerationRules,
} from "@/repositories/commission-rules";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";

export type CompensationLevel = {
  code: number;
  name: string;
  ratePercent: number;
};

export type CompensationData = {
  directRatePercent: number | null;
  levels: CompensationLevel[];
  example: { price: number; commission: number } | null;
};

// Every rate on this page is read live from the same rules the platform
// actually pays with (commission_rules) — never hand-typed — so the sales
// page can never drift from what an ambassador is really paid.
export async function getCompensationData(
  executor: Executor,
): Promise<CompensationData> {
  const [
    directRules,
    generationRules,
    levelRows,
    subscriptionPrice,
    bvValueInCfa,
  ] = await Promise.all([
    listEffectiveDirectSaleRules(executor),
    listEffectiveGenerationRules(executor),
    executor.query.levels.findMany({ orderBy: asc(levels.code) }),
    getCurrentParameterValue(executor, "subscription.price_in_cfa"),
    getCurrentParameterValue(executor, "bv.value_in_cfa"),
  ]);

  const defaultDirectRule =
    directRules.find((r) => r.courseId === null && r.category === null) ?? null;
  const directRatePercent =
    defaultDirectRule?.commissionType === "PERCENTAGE"
      ? defaultDirectRule.rate / 100
      : null;

  const nameByCode = new Map(levelRows.map((l) => [l.code, l.name]));
  const rateByLevel = new Map<number, number>();
  for (const rule of generationRules) {
    if (rule.levelCode == null) continue;
    // Both express "X% of what the generation is worth" and render
    // identically as a percentage badge — BV_PERCENTAGE is what every rule
    // is configured as today, PERCENTAGE is the price-indexed replacement
    // (business decision: BV no longer has a reason to exist now that every
    // sale is the same flat-price subscription, see repositories/
    // commission-rules.ts's computeGenerationCommission). Only matching
    // BV_PERCENTAGE here silently dropped a level from this page the moment
    // an admin migrated it to PERCENTAGE from /admin/commission-rules.
    if (
      (rule.commissionType === "PERCENTAGE" ||
        rule.commissionType === "BV_PERCENTAGE") &&
      rule.rate > 0
    ) {
      rateByLevel.set(rule.levelCode, rule.rate / 100);
    }
  }

  const compensationLevels: CompensationLevel[] = [2, 3, 4, 5]
    .filter((code) => rateByLevel.has(code))
    .map((code) => ({
      code,
      name: nameByCode.get(code) ?? `Niveau ${code}`,
      ratePercent: rateByLevel.get(code)!,
    }));

  // The worked example uses the real subscription price, run through the
  // real computeDirectSaleCommission — never a number typed by hand, so it
  // can never contradict what the platform would really pay. businessVolume
  // is irrelevant here: a PERCENTAGE-type direct-sale rule (the only kind
  // configured today) only ever reads pricePaid.
  let example: CompensationData["example"] = null;
  if (defaultDirectRule) {
    example = {
      price: subscriptionPrice,
      commission: computeDirectSaleCommission(defaultDirectRule, {
        pricePaid: subscriptionPrice,
        businessVolume: subscriptionPrice,
        bvValueInCfa,
      }),
    };
  }

  return { directRatePercent, levels: compensationLevels, example };
}
