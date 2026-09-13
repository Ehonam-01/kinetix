import "server-only";
import { asc } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { levels } from "@/db/schema/levels";
import {
  computeDirectSaleCommission,
  listEffectiveDirectSaleRules,
  listEffectiveGenerationRules,
} from "@/repositories/commission-rules";
import { listPublishedCoursesForMarketing } from "@/repositories/courses";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";

export type CompensationLevel = {
  code: number;
  name: string;
  ratePercent: number;
};

export type CompensationData = {
  directRatePercent: number | null;
  levels: CompensationLevel[];
  example: { courseTitle: string; price: number; commission: number } | null;
};

// Every rate on this page is read live from the same rules the platform
// actually pays with (commission_rules) — never hand-typed — so the sales
// page can never drift from what an ambassador is really paid. Mirrors
// repositories/courses.ts's listPublishedCoursesForMarketing precedent
// (real catalog, not a hardcoded list) applied to commission rates.
export async function getCompensationData(
  executor: Executor,
): Promise<CompensationData> {
  const [directRules, generationRules, levelRows, courses, bvValueInCfa] =
    await Promise.all([
      listEffectiveDirectSaleRules(executor),
      listEffectiveGenerationRules(executor),
      executor.query.levels.findMany({ orderBy: asc(levels.code) }),
      listPublishedCoursesForMarketing(executor, 6),
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
    if (rule.commissionType === "BV_PERCENTAGE" && rule.rate > 0) {
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

  // The worked example uses the highest-priced course actually in the
  // catalog, run through the real computeDirectSaleCommission — never a
  // number typed by hand, so it can never contradict what the platform
  // would really pay.
  let example: CompensationData["example"] = null;
  if (defaultDirectRule && courses.length > 0) {
    const highest = courses.reduce((max, c) => (c.price > max.price ? c : max));
    example = {
      courseTitle: highest.title,
      price: highest.price,
      // businessVolume is irrelevant here: a PERCENTAGE-type direct-sale
      // rule (the only kind configured today) only ever reads pricePaid —
      // see computeDirectSaleCommission. MarketingCourseSummary doesn't
      // carry the real BV figure, so this stand-in never affects the result.
      commission: computeDirectSaleCommission(defaultDirectRule, {
        pricePaid: highest.price,
        businessVolume: highest.price,
        bvValueInCfa,
      }),
    };
  }

  return { directRatePercent, levels: compensationLevels, example };
}
