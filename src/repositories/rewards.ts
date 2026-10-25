import "server-only";
import { asc, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { rewards } from "@/db/schema/rewards";

// Levels that can carry a material reward: 2 (a computer or a phone), then
// 3-5 (moto, car).
export const REWARD_LEVEL_CODES = [2, 3, 4, 5];

// The level 2-5 catalog itself (name/value/image an admin configures),
// distinct from member_rewards (repositories/member-rewards.ts — who has
// actually unlocked/claimed one). Used by both /admin/levels (to edit it)
// and /dashboard/levels (to preview what's waiting at each level, before
// it's unlocked).
export async function listRewardCatalog(executor: Executor) {
  return executor.query.rewards.findMany({
    where: inArray(rewards.levelCode, REWARD_LEVEL_CODES),
    orderBy: asc(rewards.levelCode),
  });
}
