// Local-only financial analysis: builds a real binary tree (same pglite
// sandbox as simulate-level2.test.ts — nothing shared/real touched) and
// reports TOTAL commissions paid across EVERY account against TOTAL
// subscription revenue collected, at a given set of commission rates. The
// question this answers: "can the business actually afford to pay out
// what the compensation plan promises?" — a single account's payout (what
// simulate-level2.test.ts shows) understates this, since every non-leaf
// node in the tree earns its own DIRECT_SALE/LEVEL_1_BONUS/GENERATION
// commissions on top of the sponsor's.
//
// Edit RATES below to test a scenario, then run:
//   npx vitest run src/scripts/commission-sustainability.test.ts
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { ltree } from "@electric-sql/pglite/contrib/ltree";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { describe, it, vi, expect } from "vitest";
import * as schema from "@/db/schema";

// --- Scenario knobs -------------------------------------------------
// No default commission_rules exist in the real deployment (confirmed
// earlier) — these are exploratory numbers, not committed real rates.
// F CFA throughout, matching the rest of the codebase (no floats, no
// subunit — see FINANCIAL_MODEL.md).
const SUBSCRIPTION_PRICE_CFA = 15_000;
const RATES = {
  directSaleFixed: 2500, // paid once, on a buyer's first-ever subscription
  generationFixedPerPerson: 1000, // FIXED commissionType: rate x requiredCount
};
// How many binary-tree depths to build under the root. 5 = 62 accounts
// (2+4+8+16+32), the same size simulate-level2.test.ts uses. Each extra
// depth roughly triples the account count and reshapes the ratio — worth
// re-running at a few depths to see whether it trends up or down as the
// network grows, not just its value at one arbitrary size.
const DEPTHS = 5;
// ----------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;

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
    if (file === "0030_course_thumbnails_storage.sql") continue;
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
        continue;
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

describe("commission plan sustainability (pglite, no shared DB touched)", () => {
  it(
    `total payout vs total revenue across a ${DEPTHS}-depth tree`,
    { timeout: 300_000 },
    async () => {
      const client = await PGlite.create({ extensions: { ltree } });
      localDb = wrapExecutor(drizzle(client, { schema }));

      await runMigrations(client);

      await localDb.insert(schema.parameterVersions).values([
        { parameterKey: "commission.level_1_bonus", value: 1000 },
        { parameterKey: "bv.value_in_cfa", value: 1000 },
        {
          parameterKey: "subscription.price_in_cfa",
          value: SUBSCRIPTION_PRICE_CFA,
        },
        { parameterKey: "subscription.business_volume", value: 15 },
      ]);

      await localDb.insert(schema.commissionRules).values([
        {
          scope: "DIRECT_SALE",
          commissionType: "FIXED",
          rate: RATES.directSaleFixed,
        },
        ...[2, 3, 4, 5].flatMap((levelCode) =>
          [1, 2, 3].map((generation) => ({
            scope: "GENERATION" as const,
            levelCode,
            generation,
            commissionType: "FIXED" as const,
            rate: RATES.generationFixedPerPerson,
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
            amount: SUBSCRIPTION_PRICE_CFA,
            idempotencyKey: `SIM:${userId}`,
            metadata: { ambassadorUserId, attributionId: null },
          })
          .returning();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await localDb.transaction((tx: any) =>
          confirmSubscriptionPurchase(tx, payment.id),
        );
      }

      const rootId = randomUUID();
      await seedProfile(client, {
        id: rootId,
        username: "root",
        fullName: "Root (analysis)",
      });
      await join(rootId);

      let previousDepth: { id: string; username: string }[] = [
        { id: rootId, username: "root" },
      ];
      let counter = 0;
      let subscriberCount = 0;
      for (let depth = 1; depth <= DEPTHS; depth++) {
        const currentDepth: { id: string; username: string }[] = [];
        for (const parent of previousDepth) {
          for (let child = 0; child < 2; child++) {
            counter++;
            const id = randomUUID();
            const username = `acct_d${depth}_${counter}`;
            await seedProfile(client, {
              id,
              username,
              fullName: `Account ${username}`,
            });
            await join(id, parent.username);
            await subscribe(id, parent.id);
            subscriberCount++;
            currentDepth.push({ id, username });
          }
        }
        previousDepth = currentDepth;
      }

      // --- Totals ---
      const totalRevenueRow = await localDb.execute(
        sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM payments WHERE status = 'CONFIRMED'`,
      );
      const totalRevenue = totalRevenueRow[0].total as number;

      const byType = await localDb.execute(sql`
        SELECT type, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::int AS total
        FROM commission_events
        GROUP BY type
        ORDER BY total DESC
      `);

      const totalCommissions = (byType as { total: number }[]).reduce(
        (s, r) => s + r.total,
        0,
      );

      console.log(`\n=== Scenario ===`);
      console.log(
        `Subscription price: ${SUBSCRIPTION_PRICE_CFA.toLocaleString("fr-FR")} F CFA`,
      );
      console.log(
        `Direct-sale rate: ${RATES.directSaleFixed.toLocaleString("fr-FR")} F CFA (fixed, once per new subscriber)`,
      );
      console.log(
        `Generation rate: ${RATES.generationFixedPerPerson.toLocaleString("fr-FR")} F CFA/person (fixed, per completed generation)`,
      );
      console.log(`Tree depth: ${DEPTHS} (${subscriberCount} paying accounts)`);

      console.log(`\n=== Commissions by type ===`);
      console.table(byType);

      console.log(`\n=== Totals ===`);
      console.log(
        `Total revenue collected:    ${totalRevenue.toLocaleString("fr-FR")} F CFA`,
      );
      console.log(
        `Total commissions payable:  ${totalCommissions.toLocaleString("fr-FR")} F CFA`,
      );
      console.log(
        `Payout ratio: ${((totalCommissions / totalRevenue) * 100).toFixed(1)}% of revenue`,
      );
      console.log(
        totalCommissions > totalRevenue
          ? "\n⚠️  UNSUSTAINABLE at this rate/depth: commissions payable EXCEED revenue collected."
          : "\n✅ Sustainable at this rate/depth: commissions payable stay under revenue collected.",
      );

      // Not a pass/fail assertion — this test always "passes" once it runs;
      // it exists to print the numbers above. Left in as a smoke check that
      // the whole tree actually built.
      const rootProfile = await localDb.query.profiles.findFirst({
        where: eq(schema.profiles.id, rootId),
      });
      expect(rootProfile).toBeDefined();
    },
  );
});
