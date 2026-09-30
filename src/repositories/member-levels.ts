import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { generationProgress } from "@/db/schema/generation-progress";
import { levels } from "@/db/schema/levels";
import { memberLevels } from "@/db/schema/member-levels";

// The plan's levels, in order — only the active ones: a deactivated level
// (level 5 since migration 0055) is unreachable and never shown.
export function listActiveLevels(executor: Executor) {
  return executor.query.levels.findMany({
    where: eq(levels.isActive, true),
    orderBy: asc(levels.code),
  });
}

// The top of the compensation plan: the highest active level. Completing
// it makes a member an "ancêtre" (services/mlm/unlock-level.ts).
export async function getTopLevelCode(executor: Executor): Promise<number> {
  const [row] = await executor
    .select({ top: sql<number>`max(${levels.code})` })
    .from(levels)
    .where(eq(levels.isActive, true));
  return Number(row?.top ?? 1);
}

export type LevelProgressView = {
  code: number;
  name: string;
  status: "LOCKED" | "IN_PROGRESS" | "COMPLETED";
  startedAt: Date | null;
  completedAt: Date | null;
  generations: {
    generation: number;
    requiredCount: number;
    currentCount: number;
    bvTotal: number;
    status: "PENDING" | "COMPLETED";
  }[];
};

// "LOCKED" is synthesized here for display only — never stored, same
// absence-means-locked convention as the member_levels table itself (see
// MLM_RULES.md).
export async function listLevelProgress(
  executor: Executor,
  userId: string,
): Promise<LevelProgressView[]> {
  const [allLevels, memberLevelRows, generationRows] = await Promise.all([
    listActiveLevels(executor),
    executor.query.memberLevels.findMany({
      where: eq(memberLevels.userId, userId),
    }),
    executor.query.generationProgress.findMany({
      where: eq(generationProgress.userId, userId),
    }),
  ]);

  const memberLevelByCode = new Map(
    memberLevelRows.map((row) => [row.levelCode, row]),
  );
  const generationsByCode = new Map<number, typeof generationRows>();
  for (const row of generationRows) {
    const list = generationsByCode.get(row.levelCode) ?? [];
    list.push(row);
    generationsByCode.set(row.levelCode, list);
  }

  return allLevels.map((level) => {
    const memberLevel = memberLevelByCode.get(level.code);
    return {
      code: level.code,
      name: level.name,
      status: memberLevel?.status ?? "LOCKED",
      startedAt: memberLevel?.startedAt ?? null,
      completedAt: memberLevel?.completedAt ?? null,
      generations: (generationsByCode.get(level.code) ?? [])
        .slice()
        .sort((a, b) => a.generation - b.generation),
    };
  });
}

export type LevelStats = {
  code: number;
  name: string;
  inProgress: number;
  completed: number;
};

// Platform-wide counts for the admin overview — read-only. Editing a
// level's generationSizes once members are already progressing against it
// is deliberately not exposed here: it would silently change what
// "required_count" means for generation_progress rows that already exist,
// a retroactive-rule risk on par with editing a parameter_versions row in
// place. If that need arises, it deserves its own deliberate design, not a
// quick admin form.
export async function getLevelStats(executor: Executor): Promise<LevelStats[]> {
  const [allLevels, memberLevelRows] = await Promise.all([
    listActiveLevels(executor),
    executor.query.memberLevels.findMany(),
  ]);

  const countsByCode = new Map<
    number,
    { inProgress: number; completed: number }
  >();
  for (const row of memberLevelRows) {
    const counts = countsByCode.get(row.levelCode) ?? {
      inProgress: 0,
      completed: 0,
    };
    if (row.status === "COMPLETED") counts.completed++;
    else counts.inProgress++;
    countsByCode.set(row.levelCode, counts);
  }

  return allLevels.map((level) => ({
    code: level.code,
    name: level.name,
    inProgress: countsByCode.get(level.code)?.inProgress ?? 0,
    completed: countsByCode.get(level.code)?.completed ?? 0,
  }));
}
