// The level 2 material reward (a computer or a phone), against a disposable
// pglite database with every real migration applied: an admin can set one
// up like the level 3-4 rewards, and a member completing level 2 gets it
// (to claim from their space), never credited to their balance.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createSimulationDb,
  seedBaselineParameters,
} from "./simulation-helpers";
import { toLtreeLabel } from "@/services/genealogy/ltree";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

const DAY_MS = 24 * 60 * 60 * 1000;

async function createProfile(role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `m_${id.slice(0, 8)}`,
    fullName: "Membre niveau 2",
    status: "ACTIVE",
    role,
  });
  return id;
}

// A subscribed member who completed level 1 and is one step away from
// completing level 2 (its third generation already has its 8 people).
async function memberAboutToCompleteLevel2() {
  const id = await createProfile();
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: id,
      purpose: "SUBSCRIPTION",
      method: "ADMIN_CREDIT",
      amount: 19500,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId: id,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 200 * DAY_MS),
    pricePaid: 19500,
    businessVolume: 19,
  });
  // Placed in the tree: completing level 2 unlocks level 3.
  const nodeId = randomUUID();
  await localDb.insert(schema.binaryNodes).values({
    id: nodeId,
    userId: id,
    path: toLtreeLabel(nodeId),
    depth: 0,
  });
  await localDb.insert(schema.memberLevels).values([
    { userId: id, levelCode: 1, status: "COMPLETED", completedAt: new Date() },
    { userId: id, levelCode: 2 },
  ]);
  await localDb.insert(schema.generationProgress).values([
    {
      userId: id,
      levelCode: 2,
      generation: 1,
      requiredCount: 2,
      currentCount: 2,
      status: "COMPLETED",
    },
    {
      userId: id,
      levelCode: 2,
      generation: 2,
      requiredCount: 4,
      currentCount: 4,
      status: "COMPLETED",
    },
    {
      userId: id,
      levelCode: 2,
      generation: 3,
      requiredCount: 8,
      currentCount: 8,
    },
  ]);
  return id;
}

describe("level 2 reward (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("an admin can set up a material reward for level 2", async () => {
    const { upsertRewardCatalogEntry } =
      await import("@/services/admin/upsert-reward");
    const adminId = await createProfile("ADMIN");

    const reward = await upsertRewardCatalogEntry(adminId, {
      levelCode: 2,
      name: "Ordinateur portable",
      value: 200000,
    });
    expect(reward.levelCode).toBe(2);
    expect(reward.rewardType).toBe("PHYSICAL");

    const { listRewardCatalog } = await import("@/repositories/rewards");
    const catalog = await listRewardCatalog(localDb);
    expect(catalog.map((r: { levelCode: number }) => r.levelCode)).toContain(2);

    await expect(
      upsertRewardCatalogEntry(adminId, {
        levelCode: 1,
        name: "Rien",
        value: 0,
      }),
    ).rejects.toThrow("niveaux 2 à 5");
  });

  it("completing level 2 grants the reward, without touching the balance", async () => {
    const { incrementGenerationBv } =
      await import("@/services/mlm/unlock-level");
    const id = await memberAboutToCompleteLevel2();

    await localDb.transaction((tx: never) =>
      incrementGenerationBv(tx, id, 2, 3, 0),
    );

    const level2 = await localDb.query.memberLevels.findFirst({
      where: and(
        eq(schema.memberLevels.userId, id),
        eq(schema.memberLevels.levelCode, 2),
      ),
    });
    expect(level2.status).toBe("COMPLETED");

    const granted = await localDb.query.memberRewards.findMany({
      where: eq(schema.memberRewards.userId, id),
    });
    expect(granted).toHaveLength(1);
    const reward = await localDb.query.rewards.findFirst({
      where: eq(schema.rewards.id, granted[0].rewardId),
    });
    expect(reward.name).toBe("Ordinateur portable");
    expect(granted[0].status).toBe("ELIGIBLE");

    const rewardCredits = await localDb.query.financialTransactions.findMany({
      where: and(
        eq(schema.financialTransactions.userId, id),
        eq(schema.financialTransactions.type, "REWARD"),
      ),
    });
    expect(rewardCredits).toHaveLength(0);
  });
});
