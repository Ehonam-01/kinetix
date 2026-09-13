import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { binaryNodes } from "@/db/schema/binary-nodes";
import { childPath, toLtreeLabel } from "./ltree";
import { findPlacementSlot, type PlacementNode } from "./placement";

// Creates the single root of the platform-wide binary tree. Must be called
// at most once (typically an admin/bootstrap action) — every other member
// is placed under a sponsor via placeMember. Takes an Executor rather than
// opening its own transaction, so callers (e.g.
// services/payments/activate-registration.ts) can run it atomically
// alongside payment confirmation, level 1 unlock, and commission.
export async function createRootNode(tx: Executor, userId: string) {
  const existingRoot = await tx.query.binaryNodes.findFirst({
    where: isNull(binaryNodes.binaryParentId),
  });
  if (existingRoot) {
    throw new Error("Un nœud racine existe déjà dans l'arbre binaire.");
  }

  const id = randomUUID();
  const [node] = await tx
    .insert(binaryNodes)
    .values({
      id,
      userId,
      path: toLtreeLabel(id),
      depth: 0,
    })
    .returning();

  return node;
}

// Places a new member under their sponsor's binary node, using the greedy
// lighter-leg-first descent validated in the architecture report. Never
// reassigns an existing node — placement is immutable once inserted.
export async function placeMember(
  tx: Executor,
  userId: string,
  sponsorUserId: string,
) {
  const sponsorNode = await tx.query.binaryNodes.findFirst({
    where: eq(binaryNodes.userId, sponsorUserId),
  });
  if (!sponsorNode) {
    throw new Error(
      "Le parrain n'a pas encore de position dans l'arbre binaire.",
    );
  }

  const getChild = async (parentId: string, position: "LEFT" | "RIGHT") =>
    tx.query.binaryNodes.findFirst({
      where: and(
        eq(binaryNodes.binaryParentId, parentId),
        eq(binaryNodes.binaryPosition, position),
      ),
    });

  const { parent, position } = await findPlacementSlot(
    sponsorNode as PlacementNode,
    getChild,
  );

  const id = randomUUID();
  const path = childPath(parent.path, toLtreeLabel(id));

  const [node] = await tx
    .insert(binaryNodes)
    .values({
      id,
      userId,
      binaryParentId: parent.id,
      binaryPosition: position,
      path,
      depth: parent.depth + 1,
    })
    .returning();

  // Every ancestor's counter must reflect the position of ITS OWN child
  // that leads toward the new node — not the new node's position under
  // its immediate parent (only true for the direct parent itself).
  // subpath(new path, 0, nlevel(ancestor.path) + 1) is exactly that
  // intermediate child's path, for every ancestor at once.
  await tx.execute(sql`
    UPDATE binary_nodes AS ancestor
    SET
      left_subtree_count = ancestor.left_subtree_count
        + (CASE WHEN child.binary_position = 'LEFT' THEN 1 ELSE 0 END),
      right_subtree_count = ancestor.right_subtree_count
        + (CASE WHEN child.binary_position = 'RIGHT' THEN 1 ELSE 0 END)
    FROM binary_nodes AS child
    WHERE ancestor.path @> ${path}::ltree
      AND nlevel(ancestor.path) < nlevel(${path}::ltree)
      AND child.path = subpath(${path}::ltree, 0, nlevel(ancestor.path) + 1)
  `);

  return node;
}
