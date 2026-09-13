import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { binaryNodes } from "@/db/schema/binary-nodes";

export function findBinaryNodeByUserId(executor: Executor, userId: string) {
  return executor.query.binaryNodes.findFirst({
    where: eq(binaryNodes.userId, userId),
  });
}

export type BinaryNodeWithGeneration = typeof binaryNodes.$inferSelect & {
  relativeGeneration: number;
};

// Raw SQL (needed for ltree operators, which Drizzle's query builder can't
// express) returns columns as-named in the SELECT list, not auto-camelCased
// the way db.query.* is — every column is aliased explicitly here to match
// the rest of the codebase's camelCase convention.
const SELECT_COLUMNS = sql`
  id,
  user_id AS "userId",
  binary_parent_id AS "binaryParentId",
  binary_position AS "binaryPosition",
  path,
  depth,
  left_subtree_count AS "leftSubtreeCount",
  right_subtree_count AS "rightSubtreeCount",
  placement_method AS "placementMethod",
  placed_at AS "placedAt"
`;

// Ancestors up to maxDepth generations above the given node (used by the
// MLM engine to propagate generation qualification — see ARCHITECTURE.md).
export async function findAncestors(
  executor: Executor,
  nodePath: string,
  maxDepth: number,
) {
  return executor.execute<BinaryNodeWithGeneration>(sql`
    SELECT ${SELECT_COLUMNS}, (nlevel(${nodePath}::ltree) - nlevel(path)) AS "relativeGeneration"
    FROM binary_nodes
    WHERE path @> ${nodePath}::ltree
      AND nlevel(${nodePath}::ltree) - nlevel(path) BETWEEN 1 AND ${maxDepth}
    ORDER BY depth
  `);
}

// Descendants at exactly the given relative depths (e.g. [1,2,3] for
// generations G1/G2/G3), used both by the MLM engine and the genealogy UI.
export async function findDescendantsAtDepths(
  executor: Executor,
  nodePath: string,
  relativeDepths: number[],
) {
  return executor.execute<BinaryNodeWithGeneration>(sql`
    SELECT ${SELECT_COLUMNS}, (nlevel(path) - nlevel(${nodePath}::ltree)) AS "relativeGeneration"
    FROM binary_nodes
    WHERE path <@ ${nodePath}::ltree
      AND (nlevel(path) - nlevel(${nodePath}::ltree)) IN ${relativeDepths}
    ORDER BY path
  `);
}

export type DownlineSearchMatch = {
  userId: string;
  fullName: string;
  username: string;
  relativeGeneration: number;
};

// In SQL LIKE/ILIKE, `_` matches any single character and `%` matches any
// run of characters — both are ordinary characters in a username (allowed
// by the registration regex), so a literal search must escape them (and
// any literal backslash) before they reach the pattern, or "demo_g1_a"
// silently over-matches anything shaped like "demoXg1Xa". Exported (not
// just used internally) so it has its own regression test — see
// binary-nodes.test.ts.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Pseudo lookup scoped to the searcher's own downline (not the whole
// platform — a member browsing "Mon réseau" has no reason to see people
// outside it), at any depth, unlike the fixed 2/3-generation tree render.
export async function searchDescendantsByUsername(
  executor: Executor,
  nodePath: string,
  query: string,
  limit = 50,
) {
  const pattern = `%${escapeLikePattern(query)}%`;
  return executor.execute<DownlineSearchMatch>(sql`
    SELECT
      bn.user_id AS "userId",
      p.full_name AS "fullName",
      p.username AS "username",
      (nlevel(bn.path) - nlevel(${nodePath}::ltree)) AS "relativeGeneration"
    FROM binary_nodes bn
    JOIN profiles p ON p.id = bn.user_id
    WHERE bn.path <@ ${nodePath}::ltree
      AND bn.path != ${nodePath}::ltree
      AND p.username ILIKE ${pattern}
    ORDER BY nlevel(bn.path)
    LIMIT ${limit}
  `);
}
