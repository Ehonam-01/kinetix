// The support WhatsApp number set by the admin: normalized to the digits a
// wa.me link wants, cleared by an empty input, refused when malformed or
// set by a non-admin. Disposable pglite database.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createSimulationDb } from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

async function makeProfile(role: "USER" | "ADMIN") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `p_${id.slice(0, 8)}`,
    fullName: "Profil test",
    status: "ACTIVE",
    role,
  });
  return id;
}

describe("support WhatsApp number", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
  }, 120_000);

  it("normalizes the usual ways of typing a number", async () => {
    const { normalizeWhatsappNumber } =
      await import("@/services/admin/update-support-whatsapp");
    expect(normalizeWhatsappNumber("+228 90 00 00 00")).toBe("22890000000");
    expect(normalizeWhatsappNumber("00228-90.00.00.00")).toBe("22890000000");
    expect(normalizeWhatsappNumber("  ")).toBeNull();
    expect(() => normalizeWhatsappNumber("90 00")).toThrow("Numéro invalide");
    expect(() => normalizeWhatsappNumber("+228 9O 00 00 00")).toThrow(
      "Numéro invalide",
    );
  });

  it("is saved by an admin, cleared by an empty input, refused to a member", async () => {
    const { updateSupportWhatsapp } =
      await import("@/services/admin/update-support-whatsapp");
    const { getSupportWhatsapp } =
      await import("@/repositories/payment-settings");
    const admin = await makeProfile("ADMIN");

    await updateSupportWhatsapp(admin, "+228 90 00 00 00");
    expect(await getSupportWhatsapp(localDb)).toBe("22890000000");

    await updateSupportWhatsapp(admin, "");
    expect(await getSupportWhatsapp(localDb)).toBeNull();

    const member = await makeProfile("USER");
    await expect(updateSupportWhatsapp(member, "+22890000000")).rejects.toThrow(
      "Seul un administrateur",
    );
  });
});
