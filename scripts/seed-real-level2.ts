// Creates a real 62-account binary tree under an existing ambassador
// (SPONSOR_USERNAME) in the actual Supabase project, using the app's own
// service functions (join-program, confirm-subscription-payment) — the
// exact same code path a real signup/subscription takes. Every account is
// tagged with RUN_ID in its username/email so it's trivially identifiable,
// and every created id is written to seed-real-level2.<RUN_ID>.json for
// cleanup-real-level2.ts to consume afterward.
//
// Run from the project root (same command in PowerShell, bash, anything —
// no shell-specific env var syntax needed; --env-file can't go through
// NODE_OPTIONS, hence passing everything directly to node instead of via
// npx, which has its own unrelated bug when NODE_OPTIONS carries --env-file):
//   node --conditions=react-server --env-file=.env.local --import tsx scripts/seed-real-level2.ts
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { commissionRules } from "@/db/schema/commission-rules";
import { parameterVersions } from "@/db/schema/parameter-versions";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { joinAmbassadorProgram } from "@/services/ambassador/join-program";
import { confirmSubscriptionPurchase } from "@/services/subscriptions/confirm-subscription-payment";

const SPONSOR_USERNAME = "ehonam"; // the real account that should complete Level 2
const RUN_ID = randomBytes(3).toString("hex");
const PASSWORD = `Sim-${randomBytes(6).toString("hex")}!`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).",
  );
}
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Created = { id: string; username: string; email: string; depth: number };
const created: Created[] = [];

async function ensureParameter(key: string, value: number) {
  const existing = await db.query.parameterVersions.findFirst({
    where: eq(parameterVersions.parameterKey, key),
    orderBy: (t, { desc }) => desc(t.effectiveFrom),
  });
  if (existing) return;
  await db.insert(parameterVersions).values({ parameterKey: key, value });
}

async function ensureCommissionRulesSeeded() {
  const existingDirect = await db.query.commissionRules.findFirst({
    where: eq(commissionRules.scope, "DIRECT_SALE"),
  });
  if (!existingDirect) {
    await db.insert(commissionRules).values({
      scope: "DIRECT_SALE",
      commissionType: "FIXED",
      rate: 500,
    });
    console.log("Seeded a default DIRECT_SALE commission rule (500 F CFA).");
  }

  for (const levelCode of [2, 3, 4, 5]) {
    for (const generation of [1, 2, 3]) {
      const existing = await db.query.commissionRules.findFirst({
        where: (t, { and, eq: eqOp }) =>
          and(
            eqOp(t.scope, "GENERATION"),
            eqOp(t.levelCode, levelCode),
            eqOp(t.generation, generation),
          ),
      });
      if (!existing) {
        await db.insert(commissionRules).values({
          scope: "GENERATION",
          levelCode,
          generation,
          commissionType: "FIXED",
          rate: 200,
        });
      }
    }
  }
  console.log("Seeded default GENERATION commission rules (200 F CFA/person) where missing.");
}

async function createRealMember(username: string, fullName: string) {
  const email = `${username}@kinetix-sim.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, username },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create auth user ${username}: ${error?.message}`);
  }
  const id = data.user.id;

  // Mirrors services/auth/ensure-profile.ts — a real signup gets this via
  // the auth callback route; we call it here since we bypass that flow.
  await db.insert(profiles).values({ id, username, fullName });

  return id;
}

async function subscribe(userId: string, ambassadorUserId: string) {
  const [payment] = await db
    .insert(payments)
    .values({
      beneficiaryUserId: userId,
      method: "ADMIN_CREDIT",
      purpose: "SUBSCRIPTION",
      amount: 15000,
      idempotencyKey: `SIM:${RUN_ID}:${userId}`,
      metadata: { ambassadorUserId, attributionId: null },
    })
    .returning();
  await db.transaction((tx) => confirmSubscriptionPurchase(tx, payment.id));
}

async function main() {
  console.log(`Run ID: ${RUN_ID}`);
  console.log(`Shared password for every created account: ${PASSWORD}\n`);

  const sponsor = await db.query.profiles.findFirst({
    where: eq(profiles.username, SPONSOR_USERNAME),
  });
  if (!sponsor) {
    throw new Error(`No profile found for username "${SPONSOR_USERNAME}".`);
  }

  await ensureParameter("commission.level_1_bonus", 1000);
  await ensureParameter("bv.value_in_cfa", 1000);
  await ensureParameter("subscription.price_in_cfa", 15000);
  await ensureParameter("subscription.business_volume", 15);
  await ensureCommissionRulesSeeded();

  let previousDepth: { id: string; username: string }[] = [
    { id: sponsor.id, username: SPONSOR_USERNAME },
  ];
  let counter = 0;

  for (let depth = 1; depth <= 5; depth++) {
    const currentDepth: { id: string; username: string }[] = [];
    for (const parent of previousDepth) {
      for (let child = 0; child < 2; child++) {
        counter++;
        const username = `sim_l2_${RUN_ID}_d${depth}_${counter}`;
        const fullName = `Simulation ${username}`;
        const id = await createRealMember(username, fullName);
        await joinAmbassadorProgram(id, {
          sponsorUsername: parent.username,
          termsVersion: "v1",
        });
        await subscribe(id, parent.id);
        created.push({
          id,
          username,
          email: `${username}@kinetix-sim.invalid`,
          depth,
        });
        currentDepth.push({ id, username });

        // Persist after every account, not just at the end — if this
        // script dies partway through, you still have a full list of
        // what to clean up.
        fs.writeFileSync(
          path.join(__dirname, `seed-real-level2.${RUN_ID}.json`),
          JSON.stringify({ runId: RUN_ID, sponsor: SPONSOR_USERNAME, created }, null, 2),
        );
      }
    }
    console.log(`Depth ${depth}: placed ${currentDepth.length} accounts (${counter} total so far)`);
    previousDepth = currentDepth;
  }

  console.log(
    `\nDone. ${created.length} real accounts created under "${SPONSOR_USERNAME}".`,
  );
  console.log(`Log in as ${SPONSOR_USERNAME} and open /dashboard/levels to see the result.`);
  console.log(
    `\nTo undo everything from this run:\n  node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-real-level2.ts ${RUN_ID}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    console.error(
      `\nPartial run — see seed-real-level2.${RUN_ID}.json for what was already created, and clean it up with:\n  node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-real-level2.ts ${RUN_ID}`,
    );
    process.exit(1);
  });
