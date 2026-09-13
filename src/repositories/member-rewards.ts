import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { memberRewards, rewards } from "@/db/schema/rewards";
import { profiles } from "@/db/schema/profiles";

export async function listMemberRewards(executor: Executor, userId: string) {
  const rows = await executor.query.memberRewards.findMany({
    where: eq(memberRewards.userId, userId),
    orderBy: desc(memberRewards.unlockedAt),
  });
  if (rows.length === 0) return [];

  const rewardIds = rows.map((row) => row.rewardId);
  const rewardDefs = await executor.query.rewards.findMany({
    where: inArray(rewards.id, rewardIds),
  });
  const rewardById = new Map(rewardDefs.map((r) => [r.id, r]));

  return rows.map((row) => ({
    ...row,
    reward: rewardById.get(row.rewardId) ?? null,
  }));
}

// Cross-member view for the admin delivery-management page — same join as
// listMemberRewards above, plus the member's name since an admin needs to
// know whose reward this is.
export async function listAllMemberRewards(executor: Executor) {
  const rows = await executor.query.memberRewards.findMany({
    orderBy: desc(memberRewards.unlockedAt),
  });
  if (rows.length === 0) return [];

  const rewardIds = [...new Set(rows.map((row) => row.rewardId))];
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const [rewardDefs, memberProfiles] = await Promise.all([
    executor.query.rewards.findMany({ where: inArray(rewards.id, rewardIds) }),
    executor.query.profiles.findMany({ where: inArray(profiles.id, userIds) }),
  ]);
  const rewardById = new Map(rewardDefs.map((r) => [r.id, r]));
  const nameById = new Map(memberProfiles.map((p) => [p.id, p.fullName]));

  return rows.map((row) => ({
    ...row,
    reward: rewardById.get(row.rewardId) ?? null,
    memberName: nameById.get(row.userId) ?? "Membre",
  }));
}
