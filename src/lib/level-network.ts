// A member's own network at a level above 1 (explicit user decision): the
// members below them in the level 1 tree, at any depth, who have reached
// that level, in the order they reached it. Each keeps the side of the
// member they're under in the level 1 tree (left branch stays left), and
// each side fills generation by generation, left to right: its first
// arrival right under the member, the next two below that one, the next
// four below those. The same person can sit at different places in
// different members' networks; positions beyond the level's generations
// aren't part of it.

export type Side = "LEFT" | "RIGHT";

// Someone who reached the level, from the side of the network's owner they
// are on in the level 1 tree. Given in order of arrival.
export type LevelArrival = { userId: string; side: Side };

export type LevelSlot = {
  userId: string;
  side: Side;
  generation: number;
  // Who they're right under: null for the network's owner.
  parentUserId: string | null;
  position: Side;
};

export function arrangeLevelNetwork(
  arrivals: LevelArrival[],
  generations: number,
): LevelSlot[] {
  const slots: LevelSlot[] = [];
  for (const side of ["LEFT", "RIGHT"] as const) {
    const onSide = arrivals.filter((a) => a.side === side);
    // Heap order within the side: index i sits under (i - 1) / 2, on the
    // left when i is odd.
    onSide.forEach((arrival, i) => {
      const generation = Math.floor(Math.log2(i + 1)) + 1;
      if (generation > generations) return;
      slots.push({
        userId: arrival.userId,
        side,
        generation,
        parentUserId: i === 0 ? null : onSide[Math.floor((i - 1) / 2)].userId,
        position: i === 0 ? side : i % 2 === 1 ? "LEFT" : "RIGHT",
      });
    });
  }
  return slots;
}

// How many places of each generation are taken (index 0 = generation 1).
export function countByGeneration(slots: LevelSlot[], generations: number) {
  const counts = Array.from({ length: generations }, () => 0);
  for (const slot of slots) counts[slot.generation - 1] += 1;
  return counts;
}
