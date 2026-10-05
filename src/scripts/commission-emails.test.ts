// "Félicitations, nouveau filleul": a sponsor's direct referral commission
// (DIRECT_SALE) is emailed once, with who joined, the amount and the
// balance now available; a failed send is retried; other commission types
// send nothing. Disposable pglite database, nothing shared touched.
import { randomUUID } from "node:crypto";
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
const sentEmails: { to: string; subject: string; html: string }[] = [];
let failNextSend = false;
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; subject: string; html: string }) => {
      if (failNextSend) {
        failNextSend = false;
        throw new Error("Resend indisponible");
      }
      sentEmails.push(input);
    },
  },
}));
process.env.SITE_URL ??= "https://kinetix.example";

const DAY_MS = 24 * 60 * 60 * 1000;

async function makeMember(fullName: string, username: string) {
  const id = randomUUID();
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, `${username}@example.test`],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username,
    fullName,
    status: "ACTIVE",
  });
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
    expiresAt: new Date(Date.now() + 300 * DAY_MS),
    pricePaid: 19500,
    businessVolume: 15,
  });
  return id;
}

describe("commission emails (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await seedBaselineParameters(db);
  }, 120_000);

  it("congratulates the sponsor once, with the amount and available balance", async () => {
    const { createCommissionEvent } = await import("@/services/mlm/commission");
    const { sendCommissionEmails } =
      await import("@/services/notifications/commission-emails");
    const sponsor = await makeMember("Kodjo Mensah", "kodjo");
    const referral = await makeMember("Afi Agbeko", "afi_a");

    await localDb.transaction((tx: never) =>
      createCommissionEvent(tx, {
        beneficiaryUserId: sponsor,
        sourceUserId: referral,
        type: "DIRECT_SALE",
        amount: 3900,
        dedupeKey: `test:direct:${referral}`,
      }),
    );
    // A generation commission: no email.
    await localDb.transaction((tx: never) =>
      createCommissionEvent(tx, {
        beneficiaryUserId: sponsor,
        type: "GENERATION",
        levelCode: 2,
        generation: 1,
        amount: 4000,
        dedupeKey: `test:gen:${sponsor}`,
      }),
    );

    failNextSend = true;
    expect(await sendCommissionEmails()).toEqual({ sent: 0, failed: 1 });

    expect(await sendCommissionEmails()).toEqual({ sent: 1, failed: 0 });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]).toMatchObject({
      to: "kodjo@example.test",
      subject: `Félicitations : +${(3900).toLocaleString("fr-FR")} F pour ton nouveau filleul`,
    });
    const html = sentEmails[0].html;
    expect(html).toContain("Félicitations Kodjo");
    expect(html).toContain("Afi Agbeko");
    // Both commissions are on the balance: 3 900 + 4 000.
    expect(html).toContain(`${(7900).toLocaleString("fr-FR")} F`);

    expect(await sendCommissionEmails()).toEqual({ sent: 0, failed: 0 });
  });
});
