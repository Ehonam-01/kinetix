// The platform's own account — the root of the network — which members who
// tick "Je n'ai pas de parrain" at sign-up are attached to
// (services/auth/register.ts).
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  createSimulationDb,
  seedBaselineParameters,
  seedProfile,
  simulateJoinAmbassadorProgram,
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

describe("network root (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("finds the account at the top of the network", async () => {
    const { findNetworkRootUserId } =
      await import("@/repositories/binary-nodes");
    expect(await findNetworkRootUserId(localDb)).toBeNull();

    const root = randomUUID();
    await seedProfile(localClient, localDb, {
      id: root,
      username: "kinetix",
      fullName: "Kinetix Africa",
    });
    await simulateJoinAmbassadorProgram(root);

    const member = randomUUID();
    await seedProfile(localClient, localDb, {
      id: member,
      username: "ama",
      fullName: "Ama Test",
    });
    await simulateJoinAmbassadorProgram(member, "kinetix");

    expect(await findNetworkRootUserId(localDb)).toBe(root);
  });
});
