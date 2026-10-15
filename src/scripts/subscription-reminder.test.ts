// An admin's "Relancer par email" on a member who hasn't paid, against a
// disposable pglite database with every real migration applied: sent to a
// member who never subscribed (with the launch price), at most once a day,
// never to a member with an active subscription, only by an admin.
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
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
const sentEmails: { to: string; subject: string; html: string }[] = [];
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; subject: string; html: string }) => {
      sentEmails.push(input);
    },
  },
}));
process.env.SITE_URL ??= "https://kinetix.example";

async function makeProfile(
  label: string,
  options: { role?: "ADMIN"; status?: "ACTIVE" | "PENDING_PAYMENT" } = {},
) {
  const id = randomUUID();
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, `${label}@example.test`],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `${label} Test`,
    status: options.status ?? "PENDING_PAYMENT",
    role: options.role ?? "USER",
  });
  return id;
}

describe("subscription reminder (pglite)", () => {
  let admin: string;

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await db
      .delete(schema.parameterVersions)
      .where(
        inArray(schema.parameterVersions.parameterKey, [
          "subscription.price_in_cfa",
          "subscription.regular_price_in_cfa",
        ]),
      );
    await db.insert(schema.parameterVersions).values([
      { parameterKey: "subscription.price_in_cfa", value: 19500 },
      { parameterKey: "subscription.regular_price_in_cfa", value: 55000 },
    ]);
    admin = await makeProfile("admin", { role: "ADMIN", status: "ACTIVE" });
  }, 120_000);

  it("emails a member who never subscribed, once a day at most", async () => {
    const { sendSubscriptionReminder, getLastSubscriptionReminder } =
      await import("@/services/admin/send-subscription-reminder");
    const member = await makeProfile("afi");

    await sendSubscriptionReminder(admin, member);
    const email = sentEmails.at(-1)!;
    expect(email.to).toBe("afi@example.test");
    expect(email.subject).toBe("Active ton abonnement Kinetix Africa");
    expect(email.html).toContain("19");
    expect(email.html).toContain("/dashboard/subscription");
    expect(await getLastSubscriptionReminder(member)).toBeInstanceOf(Date);

    await expect(sendSubscriptionReminder(admin, member)).rejects.toThrow(
      "moins de 24 h",
    );

    // A day later, it can go again.
    await localDb.execute(
      sql`UPDATE audit_logs SET created_at = created_at - interval '25 hours' WHERE target_id = ${member}`,
    );
    await sendSubscriptionReminder(admin, member);
    expect(sentEmails.filter((e) => e.to === "afi@example.test")).toHaveLength(
      2,
    );
  });

  it("never reminds a member whose subscription is active", async () => {
    const { sendSubscriptionReminder } =
      await import("@/services/admin/send-subscription-reminder");
    const member = await makeProfile("ama", { status: "ACTIVE" });
    const [payment] = await localDb
      .insert(schema.payments)
      .values({
        beneficiaryUserId: member,
        purpose: "SUBSCRIPTION",
        method: "ADMIN_CREDIT",
        amount: 19500,
        status: "CONFIRMED",
        idempotencyKey: `TEST:${randomUUID()}`,
      })
      .returning();
    await localDb.insert(schema.subscriptions).values({
      userId: member,
      paymentId: payment.id,
      expiresAt: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
      pricePaid: 19500,
      businessVolume: 15,
    });

    await expect(sendSubscriptionReminder(admin, member)).rejects.toThrow(
      "rien à payer",
    );
  });

  it("only lets an admin send it", async () => {
    const { sendSubscriptionReminder } =
      await import("@/services/admin/send-subscription-reminder");
    const member = await makeProfile("yao");
    const other = await makeProfile("kofi", { status: "ACTIVE" });
    await expect(sendSubscriptionReminder(other, member)).rejects.toThrow(
      "Seul un administrateur",
    );
    const reminders = await localDb
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.targetId, member));
    expect(reminders).toHaveLength(0);
  });
});
