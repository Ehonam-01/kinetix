import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { memberLevels } from "@/db/schema/member-levels";
import { profiles } from "@/db/schema/profiles";
import {
  findAncestors,
  findBinaryNodeByUserId,
  findDescendantsAtDepths,
  searchDescendantsByUsername,
  type BinaryNodeWithGeneration,
} from "./binary-nodes";

export type NetworkChild = {
  id: string;
  userId: string;
  fullName: string;
  username: string;
  position: "LEFT" | "RIGHT" | null;
  leftSubtreeCount: number;
  rightSubtreeCount: number;
  currentLevelCode: number | null;
  children: NetworkChild[];
};

export type NetworkView = {
  username: string;
  currentLevelCode: number | null;
  leftSubtreeCount: number;
  rightSubtreeCount: number;
  children: NetworkChild[];
};

// The highest level each of these users has a member_levels row for
// (regardless of IN_PROGRESS/COMPLETED) — "their current level", same
// definition used on the member dashboard overview.
async function getHighestLevelCodes(
  executor: Executor,
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await executor.query.memberLevels.findMany({
    where: inArray(memberLevels.userId, userIds),
  });
  const highest = new Map<string, number>();
  for (const row of rows) {
    const current = highest.get(row.userId) ?? 0;
    if (row.levelCode > current) highest.set(row.userId, row.levelCode);
  }
  return highest;
}

function toChild(
  node: BinaryNodeWithGeneration,
  profileById: Map<string, { fullName: string; username: string }>,
  levelByUserId: Map<string, number>,
): Omit<NetworkChild, "children"> {
  const profile = profileById.get(node.userId);
  return {
    id: node.id,
    userId: node.userId,
    fullName: profile?.fullName ?? "Membre",
    username: profile?.username ?? "—",
    position: node.binaryPosition,
    leftSubtreeCount: node.leftSubtreeCount,
    rightSubtreeCount: node.rightSubtreeCount,
    currentLevelCode: levelByUserId.get(node.userId) ?? null,
  };
}

// A read-only view composed for the "Mon réseau" page. maxDepth is
// level-dependent (2 generations for level 1, 3 for levels 2-5 — see
// levels.config.generationSizes) rather than a fixed constant, since a
// member's own generation structure now differs by which level they're
// viewing.
export async function getNetworkView(
  executor: Executor,
  userId: string,
  maxDepth: number,
): Promise<NetworkView | null> {
  const node = await findBinaryNodeByUserId(executor, userId);
  if (!node) return null;

  const depths = Array.from({ length: maxDepth }, (_, i) => i + 1);
  const [self, descendants] = await Promise.all([
    executor.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    findDescendantsAtDepths(executor, node.path, depths),
  ]);

  const relatedUserIds = descendants.map((d) => d.userId);
  const [relatedProfiles, levelByUserId] = await Promise.all([
    relatedUserIds.length
      ? executor.query.profiles.findMany({
          where: inArray(profiles.id, relatedUserIds),
        })
      : Promise.resolve([]),
    getHighestLevelCodes(executor, [userId, ...relatedUserIds]),
  ]);
  const profileById = new Map(
    relatedProfiles.map((p) => [
      p.id,
      { fullName: p.fullName, username: p.username },
    ]),
  );

  const byParentNodeId = new Map<string, BinaryNodeWithGeneration[]>();
  for (const d of descendants) {
    const parentId = d.binaryParentId ?? "";
    const list = byParentNodeId.get(parentId) ?? [];
    list.push(d);
    byParentNodeId.set(parentId, list);
  }

  function build(parentNodeId: string, depth: number): NetworkChild[] {
    const children = byParentNodeId.get(parentNodeId) ?? [];
    return children.map((n) => ({
      ...toChild(n, profileById, levelByUserId),
      children: depth < maxDepth ? build(n.id, depth + 1) : [],
    }));
  }

  return {
    username: self?.username ?? "—",
    currentLevelCode: levelByUserId.get(userId) ?? null,
    leftSubtreeCount: node.leftSubtreeCount,
    rightSubtreeCount: node.rightSubtreeCount,
    children: build(node.id, 1),
  };
}

// Used by the network page to show "who sponsored/placed me" context above
// the member's own subtree — up to 3 generations, matching the propagation
// window the MLM engine itself uses (see unlock-level.ts).
export async function getAncestorNames(executor: Executor, userId: string) {
  const node = await findBinaryNodeByUserId(executor, userId);
  if (!node) return [];

  const ancestors = await findAncestors(executor, node.path, 3);
  const ancestorIds = ancestors.map((a) => a.userId);
  const relatedProfiles = ancestorIds.length
    ? await executor.query.profiles.findMany({
        where: inArray(profiles.id, ancestorIds),
      })
    : [];
  const usernameById = new Map(relatedProfiles.map((p) => [p.id, p.username]));

  return ancestors
    .slice()
    .sort((a, b) => a.relativeGeneration - b.relativeGeneration)
    .map((a) => ({
      username: usernameById.get(a.userId) ?? "—",
      relativeGeneration: a.relativeGeneration,
    }));
}

export type DownlineSearchResult = {
  userId: string;
  fullName: string;
  username: string;
  relativeGeneration: number;
  currentLevelCode: number | null;
};

// Pseudo lookup across the member's *entire* downline, independent of the
// tree render's maxDepth — a search match several generations past what's
// visually rendered should still be findable.
export async function searchDownlineMembers(
  executor: Executor,
  userId: string,
  query: string,
): Promise<DownlineSearchResult[]> {
  const node = await findBinaryNodeByUserId(executor, userId);
  if (!node || query.trim() === "") return [];

  const matches = await searchDescendantsByUsername(
    executor,
    node.path,
    query.trim(),
  );
  const levelByUserId = await getHighestLevelCodes(
    executor,
    matches.map((m) => m.userId),
  );

  return matches.map((m) => ({
    ...m,
    currentLevelCode: levelByUserId.get(m.userId) ?? null,
  }));
}
