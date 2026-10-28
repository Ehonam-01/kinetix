// A sponsor searching their network by pseudo gets each downline member's
// WhatsApp number along with their name, so they can reach them; a member
// outside their downline is never returned. Disposable pglite database.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createSimulationDb,
  seedBaselineParameters,
  seedDefaultCommissionRules,
  seedProfile,
  simulateJoinAmbassadorProgram,
  simulateSubscriptionPayment,
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
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: { sendEmail: async () => {} },
}));

async function member(username: string, sponsor?: string, phone?: string) {
  const id = randomUUID();
  await seedProfile(localClient, localDb, {
    id,
    username,
    fullName: `Membre ${username}`,
  });
  if (phone) {
    await localDb
      .update(schema.profiles)
      .set({ phone })
      .where(eq(schema.profiles.id, id));
  }
  await simulateSubscriptionPayment(localDb, id, null);
  await simulateJoinAmbassadorProgram(id, sponsor);
  return id;
}

describe("downline contact", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await seedBaselineParameters(db);
    await seedDefaultCommissionRules(db);
  }, 120_000);

  it("shows each downline member's WhatsApp to their upline", async () => {
    const { searchDownlineMembers } = await import("@/repositories/network");
    const root = await member("racine");
    await member("kodjo", "racine", "22890000000");
    await member("afi", "kodjo");
    const outsider = await member("dehors", "racine", "22891111111");

    const found = await searchDownlineMembers(localDb, root, "kodjo");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      username: "kodjo",
      fullName: "Membre kodjo",
      phone: "22890000000",
    });
    // No number given: null, shown as "non renseigné".
    expect(
      (await searchDownlineMembers(localDb, root, "afi"))[0].phone,
    ).toBeNull();

    // Kodjo's downline doesn't include his sponsor's other branch.
    const kodjo = (await searchDownlineMembers(localDb, root, "kodjo"))[0];
    expect(
      await searchDownlineMembers(localDb, kodjo.userId, "dehors"),
    ).toEqual([]);
    expect(outsider).toBeTruthy();
  });

  it("finds a downline member by name or full email, never outside it", async () => {
    const { searchDownlineMembers } = await import("@/repositories/network");
    const top = await member("sommet", "racine");
    const yao = await member("yao", "sommet");
    const other = await member("autre", "racine");
    await localClient.query(
      'UPDATE "auth"."users" SET email = $2 WHERE id = $1;',
      [yao, "Yao.Mensah@example.test"],
    );
    await localClient.query(
      'UPDATE "auth"."users" SET email = $2 WHERE id = $1;',
      [other, "autre@example.test"],
    );

    // Part of the full name ("Membre yao"), any case.
    const byName = await searchDownlineMembers(localDb, top, "MEMBRE YAO");
    expect(byName.map((r) => r.username)).toEqual(["yao"]);

    // The whole address, any case — but not a fragment of it.
    const byEmail = await searchDownlineMembers(
      localDb,
      top,
      "yao.mensah@example.test",
    );
    expect(byEmail.map((r) => r.username)).toEqual(["yao"]);
    expect(await searchDownlineMembers(localDb, top, "mensah@")).toEqual([]);

    // Someone else's downline member, even by exact email: nothing.
    expect(
      await searchDownlineMembers(localDb, top, "autre@example.test"),
    ).toEqual([]);
  });
});
