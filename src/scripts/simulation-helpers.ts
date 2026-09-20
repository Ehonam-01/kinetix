// Shared by every local-only simulation script in this folder (simulate-
// level2.test.ts, simulate-network.test.ts, ...) — a disposable in-memory
// Postgres (pglite, WASM, never touches the network) with the real
// migrations applied, driven by the actual application services. Same code
// path a real signup/payment takes, aimed at a throwaway local database
// instead of the shared one. Nothing here is part of the app itself or its
// regular test suite — it exists purely so business logic (level
// progression, commission math, ambassador placement) can be exercised and
// inspected without spending real money or touching production.
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { ltree } from "@electric-sql/pglite/contrib/ltree";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

// drizzle-orm/pglite's db.execute()/tx.execute() returns { rows, fields, ... }
// while drizzle-orm/postgres-js (what the real app uses) returns the row
// array directly — repositories/binary-nodes.ts's raw ltree queries rely on
// that array-shaped return. Wrapping (recursively, so every tx handed to a
// db.transaction(...) callback is wrapped too) normalizes pglite to match,
// without touching the real repository code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapExecutor(target: any): any {
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
      file === "0041_reward_images_storage.sql" ||
      file === "0050_fix_storage_admin_check.sql"
    )
      continue; // Supabase Storage, not app schema
    const sqlText = fs.readFileSync(path.join(dir, file), "utf8");
    const statements = sqlText
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

// Creates the disposable pglite instance, runs every real migration against
// it, and returns a drizzle client shaped like the real app's db (via
// wrapExecutor). Callers still need their own `vi.mock("@/db/client", ...)`
// pointed at the returned db — that has to live in the calling test file
// for Vitest's hoisting to see it.
export async function createSimulationDb() {
  const client = await PGlite.create({ extensions: { ltree } });
  const db = wrapExecutor(drizzle(client, { schema }));
  await runMigrations(client);
  return { client, db };
}

export async function seedProfile(
  client: PGlite,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  input: { id: string; username: string; fullName: string },
) {
  await client.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
    input.id,
  ]);
  await db.insert(schema.profiles).values({
    id: input.id,
    username: input.username,
    fullName: input.fullName,
    status: "ACTIVE",
  });
}

// Same baseline financial parameters every simulation script has needed so
// far — subscription.price_in_cfa matches the real deployment's seeded
// value (migrations 0006/0032/0036) so the commission math shown here
// matches what production would compute today. Callers can insert
// additional/overriding rows after calling this if a scenario needs
// different numbers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedBaselineParameters(db: any) {
  await db.insert(schema.parameterVersions).values([
    { parameterKey: "bv.value_in_cfa", value: 1000 },
    { parameterKey: "subscription.price_in_cfa", value: 15000 },
    { parameterKey: "subscription.business_volume", value: 15 },
  ]);
}

// No default commission_rules exist in the real deployment (an admin has
// to create them from /admin/commission-rules) — seeded here so a
// simulation actually pays something instead of silently skipping every
// commission. FIXED 500 F CFA direct-sale, FIXED 200 F/person generation
// for every (level, generation) pair — adjust per-scenario if a script
// needs different rates.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function seedDefaultCommissionRules(db: any) {
  await db.insert(schema.commissionRules).values([
    { scope: "DIRECT_SALE", commissionType: "FIXED", rate: 500 },
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
}

// "Paid" via ADMIN_CREDIT, never a real payment provider — this is what
// makes the whole simulation free to run as many times as needed. Always
// succeeds (no failure-path simulation): mirrors the one real service
// function (confirmSubscriptionPurchase) a webhook-confirmed payment would
// call, so the resulting ACTIVE status, subscription row and commission
// events are exactly what a real payment would have produced.
export async function simulateSubscriptionPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  ambassadorUserId: string | null,
) {
  const { confirmSubscriptionPurchase } = await import(
    "@/services/subscriptions/confirm-subscription-payment"
  );
  const [payment] = await db
    .insert(schema.payments)
    .values({
      beneficiaryUserId: userId,
      method: "ADMIN_CREDIT",
      purpose: "SUBSCRIPTION",
      amount: 15000,
      idempotencyKey: `SIM:${userId}:${Date.now()}`,
      metadata: { ambassadorUserId, attributionId: null },
    })
    .returning();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.transaction((tx: any) => confirmSubscriptionPurchase(tx, payment.id));
}

export async function simulateJoinAmbassadorProgram(
  userId: string,
  sponsorUsername?: string,
) {
  const { joinAmbassadorProgramInNewTransaction } = await import(
    "@/services/ambassador/join-program"
  );
  await joinAmbassadorProgramInNewTransaction(userId, {
    sponsorUsername,
    termsVersion: "v1",
  });
}
