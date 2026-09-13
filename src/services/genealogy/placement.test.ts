import { describe, expect, it } from "vitest";
import { findPlacementSlot, type PlacementNode } from "./placement";

type FakeNode = PlacementNode & { left?: string; right?: string };

function fakeTree(nodes: Record<string, FakeNode>) {
  return async (parentId: string, position: "LEFT" | "RIGHT") => {
    const parent = nodes[parentId];
    const childId = position === "LEFT" ? parent.left : parent.right;
    return childId ? nodes[childId] : undefined;
  };
}

describe("findPlacementSlot", () => {
  it("fills the sponsor's LEFT slot first", async () => {
    const A: FakeNode = {
      id: "A",
      path: "a",
      depth: 0,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
    };
    const slot = await findPlacementSlot(A, fakeTree({ A }));
    expect(slot).toEqual({ parent: A, position: "LEFT" });
  });

  it("fills the sponsor's RIGHT slot once LEFT is taken", async () => {
    const A: FakeNode = {
      id: "A",
      path: "a",
      depth: 0,
      leftSubtreeCount: 1,
      rightSubtreeCount: 0,
      left: "B",
    };
    const B: FakeNode = {
      id: "B",
      path: "a.b",
      depth: 1,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
    };
    const slot = await findPlacementSlot(A, fakeTree({ A, B }));
    expect(slot).toEqual({ parent: A, position: "RIGHT" });
  });

  it("descends into the lighter leg once both direct slots are filled", async () => {
    const A: FakeNode = {
      id: "A",
      path: "a",
      depth: 0,
      leftSubtreeCount: 1,
      rightSubtreeCount: 3,
      left: "B",
      right: "C",
    };
    const B: FakeNode = {
      id: "B",
      path: "a.b",
      depth: 1,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
    };
    const C: FakeNode = {
      id: "C",
      path: "a.c",
      depth: 1,
      leftSubtreeCount: 1,
      rightSubtreeCount: 1,
    };
    // A.left (1) <= A.right (3) -> descend into B, which is empty -> LEFT
    const slot = await findPlacementSlot(A, fakeTree({ A, B, C }));
    expect(slot).toEqual({ parent: B, position: "LEFT" });
  });

  it("prefers the left leg when both subtree counts are equal", async () => {
    const A: FakeNode = {
      id: "A",
      path: "a",
      depth: 0,
      leftSubtreeCount: 2,
      rightSubtreeCount: 2,
      left: "B",
      right: "C",
    };
    const B: FakeNode = {
      id: "B",
      path: "a.b",
      depth: 1,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
    };
    const C: FakeNode = {
      id: "C",
      path: "a.c",
      depth: 1,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
    };
    const slot = await findPlacementSlot(A, fakeTree({ A, B, C }));
    expect(slot).toEqual({ parent: B, position: "LEFT" });
  });

  it("keeps descending through several already-full generations", async () => {
    // A -> B (left, full) -> D (left, empty)
    //   -> C (right, full)
    const A: FakeNode = {
      id: "A",
      path: "a",
      depth: 0,
      leftSubtreeCount: 1,
      rightSubtreeCount: 5,
      left: "B",
      right: "C",
    };
    const B: FakeNode = {
      id: "B",
      path: "a.b",
      depth: 1,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
      left: "D",
    };
    const C: FakeNode = {
      id: "C",
      path: "a.c",
      depth: 1,
      leftSubtreeCount: 2,
      rightSubtreeCount: 2,
    };
    const D: FakeNode = {
      id: "D",
      path: "a.b.d",
      depth: 2,
      leftSubtreeCount: 0,
      rightSubtreeCount: 0,
    };
    // A.left(1) <= A.right(5) -> B; B.left(0) <= B.right(0) -> B.left=D exists -> RIGHT of B is empty
    const slot = await findPlacementSlot(A, fakeTree({ A, B, C, D }));
    expect(slot).toEqual({ parent: B, position: "RIGHT" });
  });
});
