// Local-only simulation: builds a disposable in-memory Postgres (pglite,
// WASM, never touches the network) with the real migrations applied, then
// drives the actual application services (joinAmbassadorProgram,
// confirmSubscriptionPurchase) to grow a real binary tree until "ehonam"'s
// Level 2 completes — same code path a real signup would take, just aimed
// at a throwaway local database instead of the shared one. Run with:
//   npx vitest run src/scripts/simulate-level2.test.ts
// Delete this file when done; it's not part of the app or its test suite.
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { ltree } from "@electric-sql/pglite/contrib/ltree";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { describe, it, vi, expect } from "vitest";
import * as schema from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;

// drizzle-orm/pglite's db.execute()/tx.execute() returns { rows, fields, ... }
// while drizzle-orm/postgres-js (what the real app uses) returns the row
// array directly — repositories/binary-nodes.ts's raw ltree queries rely on
// that array-shaped return. Wrapping (recursively, so every tx handed to a
// db.transaction(...) callback is wrapped too) normalizes pglite to match,
// without touching the real repository code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapExecutor(target: any): any {
  return new Proxy(target, {
    get(t, prop, receiver) {
      if (prop === "execute") {
        return async (...args: unknown[]) => {
          const result = await t.execute(...args);
          return result?.rows ?? result;
        };
      }
      if (prop === "transaction") {
        return (callback: (tx: unknown) => unknown, ...rest: unknown[]) =>
          t.transaction((tx: unknown) => callback(wrapExecutor(tx)), ...rest);
      }
      const value = Reflect.get(t, prop, receiver);
      return typeof value === "function" ? value.bind(t) : value;
    },
  });
}

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

async function runMigrations(client: PGlite) {
  await client.exec('CREATE SCHEMA IF NOT EXISTS "auth";');
  await client.exec(
    'CREATE TABLE IF NOT EXISTS "auth"."users" (id uuid PRIMARY KEY);',
  );

  const dir = path.resolve(__dirname, "../db/migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (
      file === "0030_course_thumbnails_storage.sql" ||
      file === "0041_reward_images_storage.sql"
    )
      continue; // Supabase Storage, not app schema
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      if (
        /ROW LEVEL SECURITY|CREATE POLICY|DROP POLICY|GRANT |REVOKE |auth\.uid\(\)/i.test(
          stmt,
        )
      ) {
        continue; // Supabase-only defense-in-depth, bypassed by Drizzle anyway
      }
      await client.exec(stmt + ";");
    }
  }
}

async function seedProfile(
  client: PGlite,
  input: { id: string; username: string; fullName: string },
) {
  await client.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
    input.id,
  ]);
  await localDb.insert(schema.profiles).values({
    id: input.id,
    username: input.username,
    fullName: input.fullName,
    status: "ACTIVE",
  });
}

describe("local level-2 simulation (pglite, no shared DB touched)", () => {
  it(
    "grows a real 62-node binary tree until ehonam completes level 2",
    { timeout: 300_000 },
    async () => {
      const client = await PGlite.create({ extensions: { ltree } });
      localDb = wrapExecutor(drizzle(client, { schema }));

      await runMigrations(client);

      // Baseline financial parameters — same values as the real deployment's
      // seeded migrations (0006, 0032, 0036), so the commission math this
      // simulation shows matches what production would compute today.
      await localDb.insert(schema.parameterVersions).values([
        { parameterKey: "bv.value_in_cfa", value: 1000 },
        { parameterKey: "subscription.price_in_cfa", value: 15000 },
        { parameterKey: "subscription.business_volume", value: 15 },
      ]);

      // No default commission_rules exist in the real deployment either
      // (flagged in the earlier research) — seeded here so this simulation
      // actually pays something instead of silently skipping every
      // commission, matching what an admin would need to configure for
      // real. FIXED 500 F CFA direct-sale, FIXED 200 F/person generation.
      await localDb.insert(schema.commissionRules).values([
        {
          scope: "DIRECT_SALE",
          commissionType: "FIXED",
          rate: 500,
        },
        ...[2, 3, 4, 5].flatMap((levelCode) =>
          [1, 2, 3].map((generation) => ({
            scope: "GENERATION" as const,
            levelCode,
            generation,
            commissionType: "FIXED" as const,
            rate: 200,
          })),
        ),
      ]);

      const { joinAmbassadorProgram } = await import(
        "@/services/ambassador/join-program"
      );
      const { confirmSubscriptionPurchase } = await import(
        "@/services/subscriptions/confirm-subscription-payment"
      );

      async function join(userId: string, sponsorUsername?: string) {
        await joinAmbassadorProgram(userId, {
          sponsorUsername,
          termsVersion: "v1",
        });
      }

      async function subscribe(userId: string, ambassadorUserId: string) {
        const [payment] = await localDb
          .insert(schema.payments)
          .values({
            beneficiaryUserId: userId,
            method: "ADMIN_CREDIT",
            purpose: "SUBSCRIPTION",
            amount: 15000,
            idempotencyKey: `SIM:${userId}`,
            metadata: { ambassadorUserId, attributionId: null },
          })
          .returning();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await localDb.transaction((tx: any) =>
          confirmSubscriptionPurchase(tx, payment.id),
        );
      }

      // Root ambassador — a local stand-in, deliberately not the real
      // "ehonam" account (this database has never seen the real one).
      const ehonamId = randomUUID();
      await seedProfile(client, {
        id: ehonamId,
        username: "ehonam",
        fullName: "AFANSI Kodjo (simulation locale)",
      });
      await join(ehonamId);

      // Full binary tree, depth 1..5 (2+4+8+16+32 = 62 accounts) — the
      // minimum shape that lets ehonam's Level 2 complete under the real
      // rattrapage/propagation rules (see unlock-level.ts): each of
      // ehonam's 14 descendants at depth 1-3 must themselves reach Level 2,
      // which itself needs their own 6-person Level-1 subtree underneath.
      let previousDepth: { id: string; username: string }[] = [
        { id: ehonamId, username: "ehonam" },
      ];
      let counter = 0;
      for (let depth = 1; depth <= 5; depth++) {
        const currentDepth: { id: string; username: string }[] = [];
        for (const parent of previousDepth) {
          for (let child = 0; child < 2; child++) {
            counter++;
            const id = randomUUID();
            const username = `sim_l2_d${depth}_${counter}`;
            await seedProfile(client, {
              id,
              username,
              fullName: `Simulation ${username}`,
            });
            await join(id, parent.username);
            await subscribe(id, parent.id);
            currentDepth.push({ id, username });
          }
        }
        console.log(
          `Depth ${depth}: placed ${currentDepth.length} accounts (${counter} total so far)`,
        );
        previousDepth = currentDepth;
      }

      // --- Results ---
      const memberLevels = await localDb.query.memberLevels.findMany({
        where: eq(schema.memberLevels.userId, ehonamId),
        orderBy: schema.memberLevels.levelCode,
      });
      const generationProgress = await localDb.query.generationProgress.findMany({
        where: eq(schema.generationProgress.userId, ehonamId),
        orderBy: [
          schema.generationProgress.levelCode,
          schema.generationProgress.generation,
        ],
      });
      const balance = await localDb.query.userBalances.findFirst({
        where: eq(schema.userBalances.userId, ehonamId),
      });
      const commissionEvents = await localDb.query.commissionEvents.findMany({
        where: eq(schema.commissionEvents.beneficiaryUserId, ehonamId),
      });

      console.log("\n=== ehonam member_levels ===");
      console.table(memberLevels);
      console.log("\n=== ehonam generation_progress ===");
      console.table(generationProgress);
      console.log("\n=== ehonam user_balances ===");
      console.table([balance]);
      console.log(
        `\n=== ehonam commission_events: ${commissionEvents.length} rows, total ${commissionEvents.reduce((s: number, e: { amount: number }) => s + e.amount, 0)} F CFA ===`,
      );
      console.table(commissionEvents);

      const level2 = memberLevels.find(
        (l: { levelCode: number }) => l.levelCode === 2,
      );
      expect(level2?.status).toBe("COMPLETED");
    },
  );
});
