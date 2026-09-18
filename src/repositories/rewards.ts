import "server-only";
import { asc, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { rewards } from "@/db/schema/rewards";

// The level 3-5 catalog itself (name/value/image an admin configures),
// distinct from member_rewards (repositories/member-rewards.ts — who has
// actually unlocked/claimed one). Used by both /admin/levels (to edit it)
// and /dashboard/levels (to preview what's waiting at each level, before
// it's unlocked).
export async function listRewardCatalog(executor: Executor) {
  return executor.query.rewards.findMany({
    where: inArray(rewards.levelCode, [3, 4, 5]),
    orderBy: asc(rewards.levelCode),
  });
}
