// Each member's own network above level 1 (lib/level-network.ts), against a
// disposable pglite database with every real migration applied: who
// reached the level below them, in order of arrival, each keeping their
// side, and only them counting towards the level.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { arrangeLevelNetwork, countByGeneration } from "@/lib/level-network";
import type { NetworkChild, NetworkView } from "@/repositories/network";
import {
  createSimulationDb,
  seedBaselineParameters,
  seedProfile,
} from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

const ids = new Map<string, string>();
const id = (name: string) => ids.get(name)!;

// A member placed in the level 1 tree under their sponsor (the first one
// is its root), having completed level 1.
async function member(name: string, sponsor?: string) {
  const { createRootNode, placeMember } =
    await import("@/services/genealogy/place-member");
  ids.set(name, randomUUID());
  await seedProfile(localClient, localDb, {
    id: id(name),
    username: name,
    fullName: name,
  });
  if (sponsor) {
    await localDb
      .insert(schema.sponsorships)
      .values({ userId: id(name), sponsorId: id(sponsor) });
    await placeMember(localDb, id(name), id(sponsor));
  } else {
    await createRootNode(localDb, id(name));
  }
  await localDb.insert(schema.memberLevels).values({
    userId: id(name),
    levelCode: 1,
    status: "COMPLETED",
    completedAt: new Date(),
  });
}

async function reachLevel2(name: string) {
  const { unlockLevel } = await import("@/services/mlm/unlock-level");
  await localDb.transaction((tx: never) => unlockLevel(tx, id(name), 2));
}

async function level2View(name: string) {
  const { getNetworkView } = await import("@/repositories/network");
  return (await getNetworkView(localDb, id(name), 3, 2)) as NetworkView;
}

const under = (
  node: { children: NetworkChild[] },
  position: "LEFT" | "RIGHT",
) => node.children.find((c) => c.position === position);

async function level2Counts(name: string) {
  const rows = await localDb.query.generationProgress.findMany({
    where: and(
      eq(schema.generationProgress.userId, id(name)),
      eq(schema.generationProgress.levelCode, 2),
    ),
  });
  return rows
    .sort(
      (a: { generation: number }, b: { generation: number }) =>
        a.generation - b.generation,
    )
    .map((r: { currentCount: number }) => r.currentCount);
}

describe("arrangeLevelNetwork", () => {
  it("fills each side by arrival, generation by generation, left to right", () => {
    const slots = arrangeLevelNetwork(
      [
        { userId: "l1", side: "LEFT" },
        { userId: "r1", side: "RIGHT" },
        { userId: "l2", side: "LEFT" },
        { userId: "l3", side: "LEFT" },
        { userId: "l4", side: "LEFT" },
      ],
      3,
    );
    const at = (userId: string) => slots.find((s) => s.userId === userId);
    expect(at("l1")).toMatchObject({ generation: 1, parentUserId: null });
    expect(at("r1")).toMatchObject({ generation: 1, position: "RIGHT" });
    expect(at("l2")).toMatchObject({ parentUserId: "l1", position: "LEFT" });
    expect(at("l3")).toMatchObject({ parentUserId: "l1", position: "RIGHT" });
    expect(at("l4")).toMatchObject({
      generation: 3,
      parentUserId: "l2",
      position: "LEFT",
    });
    expect(countByGeneration(slots, 3)).toEqual([2, 2, 1]);
  });

  it("leaves out arrivals past the level's generations", () => {
    const arrivals = Array.from({ length: 9 }, (_, i) => ({
      userId: `l${i}`,
      side: "LEFT" as const,
    }));
    expect(countByGeneration(arrangeLevelNetwork(arrivals, 3), 3)).toEqual([
      1, 2, 4,
    ]);
  });
});

describe("each member's own network above level 1 (pglite)", () => {
  beforeEach(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    ids.clear();
    await seedBaselineParameters(db);
    // Level 1 tree:       A
    //                   /   \
    //                  B     C
    //                 / \   /
    //                D   E F
    await member("A");
    await member("B", "A");
    await member("C", "A");
    await member("D", "B");
    await member("E", "B");
    await member("F", "C");
  }, 120_000);

  it("shows only the member until someone below reaches the level", async () => {
    await reachLevel2("A");
    const view = await level2View("A");
    expect(view.children).toEqual([]);
    expect(await level2Counts("A")).toEqual([0, 0, 0]);
  });

  it("orders by arrival: B under A at level 1 can sit under D at level 2", async () => {
    await reachLevel2("A");
    await reachLevel2("D");
    await reachLevel2("B");

    const a = await level2View("A");
    // Both from A's left branch: D first, right under A; B after, under D.
    expect(under(a, "LEFT")?.username).toBe("D");
    expect(under(under(a, "LEFT")!, "LEFT")?.username).toBe("B");
    expect(under(a, "RIGHT")).toBeUndefined();
    expect(await level2Counts("A")).toEqual([1, 1, 0]);

    // In B's own network, D (below B at level 1) is there, though D got
    // to level 2 first.
    const b = await level2View("B");
    expect(under(b, "LEFT")?.username).toBe("D");
    expect(await level2Counts("B")).toEqual([1, 0, 0]);
  });

  it("keeps each member on their side of the level 1 tree", async () => {
    await reachLevel2("A");
    await reachLevel2("F");
    await reachLevel2("E");

    const a = await level2View("A");
    // F arrived first but is in A's right branch: right, not left.
    expect(under(a, "RIGHT")?.username).toBe("F");
    expect(under(a, "LEFT")?.username).toBe("E");
    expect(await level2Counts("A")).toEqual([2, 0, 0]);
  });

  it("counts those who got there first once the member arrives", async () => {
    await reachLevel2("D");
    await reachLevel2("E");
    await reachLevel2("F");
    await reachLevel2("A");
    // A's network: left branch D then E, right branch F.
    expect(await level2Counts("A")).toEqual([2, 1, 0]);
  });

  it("the level 1 view is still the level 1 tree", async () => {
    const { getNetworkView } = await import("@/repositories/network");
    await reachLevel2("A");
    await reachLevel2("F");
    const level1 = (await getNetworkView(localDb, id("A"), 2)) as NetworkView;
    expect(under(level1, "LEFT")?.username).toBe("B");
    expect(under(level1, "RIGHT")?.username).toBe("C");
  });
});
