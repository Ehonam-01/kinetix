import "server-only";
import type { Executor } from "@/db/executor";
import {
  computeDirectSaleCommission,
  listEffectiveDirectSaleRules,
  listEffectiveGenerationRules,
} from "@/repositories/commission-rules";
import { listActiveLevels } from "@/repositories/member-levels";
import { listRewardCatalog } from "@/repositories/rewards";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";

// What completing a generation of this level pays, per qualified member of
// the team: a percentage of the subscription price, or a fixed amount
// (min = max when every generation of the level pays the same).
export type GenerationPay =
  | { kind: "percent"; value: number }
  | { kind: "fixed"; min: number; max: number };

export type CompensationLevel = {
  code: number;
  name: string;
  generation: GenerationPay | null;
  // The level's material reward — its name and picture only, never its
  // value (explicit decision: members see the item, not its price).
  reward: { name: string; imageUrl: string | null } | null;
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
    rewardRows,
  ] = await Promise.all([
    listEffectiveDirectSaleRules(executor),
    listEffectiveGenerationRules(executor),
    listActiveLevels(executor),
    getCurrentParameterValue(executor, "subscription.price_in_cfa"),
    getCurrentParameterValue(executor, "bv.value_in_cfa"),
    listRewardCatalog(executor),
  ]);

  const defaultDirectRule =
    directRules.find((r) => r.courseId === null && r.category === null) ?? null;
  const directRatePercent =
    defaultDirectRule?.commissionType === "PERCENTAGE"
      ? defaultDirectRule.rate / 100
      : null;

  // Generation pay per level, from the rules actually applied — all of a
  // level's generations, so a level whose generations pay differently
  // shows a range rather than one of them.
  const percentByLevel = new Map<number, number>();
  const fixedByLevel = new Map<number, number[]>();
  for (const rule of generationRules) {
    if (rule.levelCode == null || rule.rate <= 0) continue;
    if (rule.commissionType === "FIXED") {
      fixedByLevel.set(rule.levelCode, [
        ...(fixedByLevel.get(rule.levelCode) ?? []),
        rule.rate,
      ]);
    } else {
      // PERCENTAGE and the legacy BV_PERCENTAGE both read as "X % of the
      // subscription" (see computeGenerationCommission).
      percentByLevel.set(rule.levelCode, rule.rate / 100);
    }
  }
  const rewardByLevel = new Map(
    rewardRows
      .filter((r) => r.isActive)
      .map((r) => [r.levelCode, { name: r.name, imageUrl: r.imageUrl }]),
  );

  const compensationLevels: CompensationLevel[] = levelRows.map((level) => {
    const fixed = fixedByLevel.get(level.code);
    const percent = percentByLevel.get(level.code);
    return {
      code: level.code,
      name: level.name,
      generation: fixed?.length
        ? { kind: "fixed", min: Math.min(...fixed), max: Math.max(...fixed) }
        : percent != null
          ? { kind: "percent", value: percent }
          : null,
      reward: rewardByLevel.get(level.code) ?? null,
    };
  });

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
