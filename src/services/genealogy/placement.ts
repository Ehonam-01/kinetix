export type BinaryPosition = "LEFT" | "RIGHT";

export type PlacementNode = {
  id: string;
  path: string;
  depth: number;
  leftSubtreeCount: number;
  rightSubtreeCount: number;
};

export type GetChild = (
  parentId: string,
  position: BinaryPosition,
) => Promise<PlacementNode | undefined>;

// Greedy descent, lighter leg first — the placement algorithm validated in
// the architecture report (section 06 / décision n°2): O(depth), no
// favoritism, deterministic. Kept pure (no DB access) so it can be unit
// tested against an in-memory tree — see placement.test.ts. The DB-wired
// wrapper lives in place-member.ts.
export async function findPlacementSlot(
  start: PlacementNode,
  getChild: GetChild,
): Promise<{ parent: PlacementNode; position: BinaryPosition }> {
  let current = start;

  for (;;) {
    const left = await getChild(current.id, "LEFT");
    if (!left) return { parent: current, position: "LEFT" };

    const right = await getChild(current.id, "RIGHT");
    if (!right) return { parent: current, position: "RIGHT" };

    current =
      current.leftSubtreeCount <= current.rightSubtreeCount ? left : right;
  }
}
