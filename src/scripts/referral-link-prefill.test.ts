// A referral link (/r/<pseudo>) pre-fills the sponsor on the sign-up page:
// the click is recorded, its cookie token resolves back to the
// ambassador's pseudo — the value app/(auth)/register/page.tsx puts in the
// "Pseudo du parrain" field. Disposable pglite database.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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

async function makeAmbassador(pseudo: string) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: pseudo,
    fullName: "Ambassadeur test",
    status: "ACTIVE",
  });
  await localDb.insert(schema.ambassadorProfiles).values({
    userId: id,
    referralCode: pseudo,
    termsAcceptedAt: new Date(),
    termsVersion: "test",
  });
  return id;
}

describe("referral link pre-fills the sponsor (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("resolves the clicked link back to the ambassador's pseudo", async () => {
    const { recordReferralClick, resolveReferralUsername } =
      await import("@/services/attribution/resolve-referral");
    await makeAmbassador("kodjo_amb");

    const click = await recordReferralClick({
      referralCode: "kodjo_amb",
      landingPath: "/r/kodjo_amb",
    });
    expect(click).not.toBeNull();
    expect(await resolveReferralUsername(click!.visitorToken)).toBe(
      "kodjo_amb",
    );

    // No cookie, or an unknown one: nothing pre-filled.
    expect(await resolveReferralUsername(undefined)).toBeNull();
    expect(await resolveReferralUsername(randomUUID())).toBeNull();
  });

  it("a suspended ambassador's link sets nothing", async () => {
    const { recordReferralClick } =
      await import("@/services/attribution/resolve-referral");
    const id = await makeAmbassador("suspendu_amb");
    await localDb
      .update(schema.ambassadorProfiles)
      .set({ status: "SUSPENDED" })
      .where(eq(schema.ambassadorProfiles.userId, id));
    expect(
      await recordReferralClick({ referralCode: "suspendu_amb" }),
    ).toBeNull();
  });
});
