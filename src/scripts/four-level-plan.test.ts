// The 4-level plan (migration 0055), against a disposable pglite database
// with every real migration applied: level 4 is the top — completing it
// pays its last generation, makes the member an "ancêtre" and unlocks
// nothing — level 5 can no longer be unlocked, and the migration's
// backfill gives the ancêtre status to anyone who had already completed
// level 4 before the switch.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createSimulationDb,
  seedBaselineParameters,
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

const DAY_MS = 24 * 60 * 60 * 1000;

// A subscribed member who completed levels 1-3 and is one step away from
// completing level 4 (its third generation already has its 8 people).
async function memberAboutToCompleteLevel4() {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `m_${id.slice(0, 8)}`,
    fullName: "Membre niveau 4",
    status: "ACTIVE",
  });
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: id,
      purpose: "SUBSCRIPTION",
      method: "ADMIN_CREDIT",
      amount: 15000,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId: id,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 200 * DAY_MS),
    pricePaid: 15000,
    businessVolume: 15,
  });
  await localDb.insert(schema.memberLevels).values([
    { userId: id, levelCode: 1, status: "COMPLETED", completedAt: new Date() },
    { userId: id, levelCode: 2, status: "COMPLETED", completedAt: new Date() },
    { userId: id, levelCode: 3, status: "COMPLETED", completedAt: new Date() },
    { userId: id, levelCode: 4 },
  ]);
  await localDb.insert(schema.generationProgress).values([
    {
      userId: id,
      levelCode: 4,
      generation: 1,
      requiredCount: 2,
      currentCount: 2,
      status: "COMPLETED",
    },
    {
      userId: id,
      levelCode: 4,
      generation: 2,
      requiredCount: 4,
      currentCount: 4,
      status: "COMPLETED",
    },
    {
      userId: id,
      levelCode: 4,
      generation: 3,
      requiredCount: 8,
      currentCount: 8,
    },
  ]);
  return id;
}

describe("4-level plan (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    await db.insert(schema.commissionRules).values({
      scope: "GENERATION",
      levelCode: 4,
      generation: 3,
      commissionType: "FIXED",
      rate: 20000,
    });
  }, 120_000);

  it("level 5 is deactivated and the top of the plan is level 4", async () => {
    const { getTopLevelCode, listActiveLevels } =
      await import("@/repositories/member-levels");
    expect(await getTopLevelCode(localDb)).toBe(4);
    expect(
      (await listActiveLevels(localDb)).map((l: { code: number }) => l.code),
    ).toEqual([1, 2, 3, 4]);
  });

  it("completing level 4 pays it, makes the member an ancêtre and unlocks nothing", async () => {
    const { incrementGenerationBv, unlockLevel } =
      await import("@/services/mlm/unlock-level");
    const id = await memberAboutToCompleteLevel4();

    await localDb.transaction((tx: never) =>
      incrementGenerationBv(tx, id, 4, 3, 0),
    );

    const level4 = await localDb.query.memberLevels.findFirst({
      where: and(
        eq(schema.memberLevels.userId, id),
        eq(schema.memberLevels.levelCode, 4),
      ),
    });
    expect(level4.status).toBe("COMPLETED");
    const level5 = await localDb.query.memberLevels.findFirst({
      where: and(
        eq(schema.memberLevels.userId, id),
        eq(schema.memberLevels.levelCode, 5),
      ),
    });
    expect(level5).toBeUndefined();

    const events = await localDb.query.commissionEvents.findMany({
      where: eq(schema.commissionEvents.beneficiaryUserId, id),
    });
    expect(events.map((e: { amount: number }) => e.amount)).toEqual([
      20000 * 8,
    ]);

    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, id),
    });
    expect(profile.becameAncestorAt).not.toBeNull();

    // Level 5 can't be unlocked any more, even directly.
    await expect(
      localDb.transaction((tx: never) => unlockLevel(tx, id, 5)),
    ).rejects.toThrow("Niveau inconnu");
  });

  it("an ancêtre earns nothing more, but keeps their account and courses while subscribed", async () => {
    const { incrementGenerationBv } =
      await import("@/services/mlm/unlock-level");
    const { createCommissionEvent } = await import("@/services/mlm/commission");
    const { hasCourseAccess } = await import("@/repositories/courses");
    const id = await memberAboutToCompleteLevel4();
    await localDb.transaction((tx: never) =>
      incrementGenerationBv(tx, id, 4, 3, 0),
    );
    const [course] = await localDb
      .insert(schema.courses)
      .values({ title: "Formation ancêtre", status: "PUBLISHED" })
      .returning();

    // No commission of any kind any more.
    const paid = await localDb.transaction((tx: never) =>
      createCommissionEvent(tx, {
        beneficiaryUserId: id,
        type: "DIRECT_SALE",
        amount: 3900,
        dedupeKey: `test:ancestor:${id}`,
      }),
    );
    expect(paid).toBeNull();

    // The account stays active and the courses open while subscribed.
    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, id),
    });
    expect(profile.status).toBe("ACTIVE");
    expect(await hasCourseAccess(localDb, id, course.id)).toBe(true);

    // Lapsed past the grace period: no access, like any member...
    await localDb
      .update(schema.subscriptions)
      .set({ expiresAt: new Date(Date.now() - 30 * DAY_MS) })
      .where(eq(schema.subscriptions.userId, id));
    expect(await hasCourseAccess(localDb, id, course.id)).toBe(false);

    // ...and renewing gives it back.
    const [renewal] = await localDb
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
      paymentId: renewal.id,
      expiresAt: new Date(Date.now() + 365 * DAY_MS),
      pricePaid: 19500,
      businessVolume: 15,
    });
    expect(await hasCourseAccess(localDb, id, course.id)).toBe(true);
  });

  it("the migration makes anyone who already completed level 4 an ancêtre", async () => {
    const id = randomUUID();
    await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
      id,
    ]);
    await localDb.insert(schema.profiles).values({
      id,
      username: `old_${id.slice(0, 8)}`,
      fullName: "Ancien niveau 4",
      status: "ACTIVE",
    });
    const completedAt = new Date("2026-06-01T10:00:00Z");
    await localDb.insert(schema.memberLevels).values({
      userId: id,
      levelCode: 4,
      status: "COMPLETED",
      completedAt,
    });

    // Re-run migration 0055 on this pre-existing data.
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../db/migrations/0055_four_level_plan.sql"),
      "utf8",
    );
    await localClient.exec(sql);

    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, id),
    });
    expect(profile.becameAncestorAt?.toISOString()).toBe(
      completedAt.toISOString(),
    );
  });
});
