import "server-only";
import { asc, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { generationProgress } from "@/db/schema/generation-progress";
import { levels } from "@/db/schema/levels";
import { memberLevels } from "@/db/schema/member-levels";

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
    executor.query.levels.findMany({ orderBy: asc(levels.code) }),
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
    executor.query.levels.findMany({ orderBy: asc(levels.code) }),
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
