// Paying the first subscription in installments ("cagnotte"), against a
// disposable pglite database with every real migration applied: deposits
// add up, the subscription is activated only when the target is reached
// (account ACTIVE, sponsor attribution kept), a redelivered deposit counts
// once, a plan past its 3-month deadline expires with the refund worked
// out minus the withdrawal fees, the admin records the refund, and
// reminders go out before the deadline.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
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
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; subject: string; html: string }) => {
      sentEmails.push(input);
    },
  },
}));
vi.mock("@/services/payments/provider-selector", () => ({
  getActivePaymentProvider: async () => ({
    name: "PAYDUNYA",
    createPayment: async () => ({
      providerReference: `ref-${Math.random()}`,
      checkoutUrl: null,
      confirmationMessage: "Vérifiez votre téléphone.",
    }),
  }),
}));
process.env.SITE_URL ??= "https://kinetix.example";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE = 19500;
// Amounts as the app writes them (French grouping, narrow no-break space).
const F = (n: number) => `${n.toLocaleString("fr-FR")} F`;

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
    fullName: `Membre ${label}`,
    status: options.status ?? "PENDING_PAYMENT",
    role: options.role ?? "USER",
  });
  return id;
}

async function openPlan(userId: string, extra: Record<string, unknown> = {}) {
  const [plan] = await localDb
    .insert(schema.installmentPlans)
    .values({ userId, targetAmount: PRICE, ...extra })
    .returning();
  return plan;
}

// A deposit as the provider would have it pending, then confirmed through
// the same webhook path as a real one.
async function confirmDeposit(userId: string, planId: string, amount: number) {
  const { processWebhookEvent } =
    await import("@/services/payments/process-webhook-event");
  const reference = `dep-${randomUUID()}`;
  await localDb.insert(schema.payments).values({
    beneficiaryUserId: userId,
    purpose: "INSTALLMENT",
    method: "MOBILE_MONEY",
    amount,
    provider: "PAYDUNYA",
    providerReference: reference,
    idempotencyKey: `INSTALLMENT:${randomUUID()}`,
    metadata: {
      installmentPlanId: planId,
      payout: { country: "TG", operator: "TMONEY", phone: "90000000" },
    },
  });
  const event = {
    providerReference: reference,
    status: "CONFIRMED" as const,
    eventType: "test",
    dedupeKey: `test:${reference}`,
    raw: {},
  };
  await localDb.transaction((tx: never) => processWebhookEvent(tx, event));
  return event;
}

function planOf(userId: string) {
  return localDb.query.installmentPlans.findFirst({
    where: eq(schema.installmentPlans.userId, userId),
  });
}

describe("installment plans (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await seedBaselineParameters(db);
    // 2,5 % withdrawal fee, as in production.
    await db.insert(schema.parameterVersions).values([
      { parameterKey: "withdrawal.fee_percent_bp", value: 250 },
      { parameterKey: "withdrawal.fee_fixed", value: 0 },
    ]);
  }, 120_000);

  it("activates the subscription only once the deposits reach the price", async () => {
    const sponsor = await makeProfile("parrain", { status: "ACTIVE" });
    const member = await makeProfile("afi");
    const plan = await openPlan(member, { ambassadorUserId: sponsor });

    const first = await confirmDeposit(member, plan.id, 8000);
    let current = await planOf(member);
    expect(current).toMatchObject({ status: "OPEN", paidAmount: 8000 });
    const months =
      (current.deadlineAt.getTime() - current.firstDepositAt.getTime()) /
      DAY_MS;
    expect(months).toBeGreaterThan(88);
    expect(months).toBeLessThan(93);
    expect(
      await localDb.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, member),
      }),
    ).toBeUndefined();

    // The same deposit delivered twice counts once.
    const { processWebhookEvent } =
      await import("@/services/payments/process-webhook-event");
    await localDb.transaction((tx: never) =>
      processWebhookEvent(tx, { ...first, dedupeKey: "test:redelivered" }),
    );
    expect((await planOf(member)).paidAmount).toBe(8000);

    await confirmDeposit(member, plan.id, 11500);
    current = await planOf(member);
    expect(current).toMatchObject({ status: "COMPLETED", paidAmount: PRICE });

    const subscription = await localDb.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, member),
    });
    expect(subscription).toMatchObject({
      pricePaid: PRICE,
      ambassadorUserId: sponsor,
    });
    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, member),
    });
    expect(profile.status).toBe("ACTIVE");
    const subscriptionPayment = await localDb.query.payments.findFirst({
      where: and(
        eq(schema.payments.beneficiaryUserId, member),
        eq(schema.payments.purpose, "SUBSCRIPTION"),
      ),
    });
    expect(subscriptionPayment).toMatchObject({
      status: "CONFIRMED",
      amount: PRICE,
    });

    // Paid in installments once: renewals are paid in full.
    const { installmentIneligibility } =
      await import("@/services/subscriptions/installments");
    expect(await installmentIneligibility(localDb, member)).toMatch(
      /première inscription/,
    );
  });

  it("checks each deposit's amount", async () => {
    const { initiateInstallmentDeposit } =
      await import("@/services/subscriptions/installments");
    const member = await makeProfile("kossi");
    const base = {
      buyerUserId: member,
      email: "kossi@example.test",
      fullName: "Kossi Test",
      returnUrl: "https://kinetix.example/dashboard/subscription",
      country: "TG",
      operator: "TMONEY",
      phone: "90000000",
    };
    // The plan opens at the current price parameter.
    const { getCurrentParameterValue } =
      await import("@/repositories/parameter-versions");
    const price = await getCurrentParameterValue(
      localDb,
      "subscription.price_in_cfa",
    );
    await expect(
      initiateInstallmentDeposit({ ...base, amount: 500 }),
    ).rejects.toThrow(`entre ${F(1000)} et ${F(price)}`);
    await expect(
      initiateInstallmentDeposit({ ...base, amount: price + 500 }),
    ).rejects.toThrow(`entre ${F(1000)} et ${F(price)}`);

    const intent = await initiateInstallmentDeposit({ ...base, amount: 5000 });
    expect(intent.payment).toMatchObject({
      purpose: "INSTALLMENT",
      amount: 5000,
      status: "PENDING",
    });
    // The pending 5 000 F is set aside for now.
    await expect(
      initiateInstallmentDeposit({ ...base, amount: price - 4000 }),
    ).rejects.toThrow(`entre ${F(1000)} et ${F(price - 5000)}`);
  });

  it("expires past the deadline, with the refund minus withdrawal fees", async () => {
    const { processInstallmentDeadlines, markInstallmentRefunded } =
      await import("@/services/subscriptions/installments");
    const member = await makeProfile("yao");
    const admin = await makeProfile("admin", {
      role: "ADMIN",
      status: "ACTIVE",
    });
    const plan = await openPlan(member);
    await confirmDeposit(member, plan.id, 6000);
    await localDb
      .update(schema.installmentPlans)
      .set({ deadlineAt: new Date(Date.now() - DAY_MS) })
      .where(eq(schema.installmentPlans.id, plan.id));

    sentEmails.length = 0;
    const result = await processInstallmentDeadlines();
    expect(result.expired).toBeGreaterThanOrEqual(1);
    const expired = await planOf(member);
    expect(expired).toMatchObject({
      status: "EXPIRED",
      paidAmount: 6000,
      refundFee: 150, // 2,5 % of 6 000
      refundAmount: 5850,
      refundPayout: { country: "TG", operator: "TMONEY", phone: "90000000" },
    });
    expect(
      sentEmails.some(
        (e) => e.to === "yao@example.test" && /a expiré/.test(e.subject),
      ),
    ).toBe(true);
    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, member),
    });
    expect(profile.status).toBe("PENDING_PAYMENT");

    const { installmentIneligibility } =
      await import("@/services/subscriptions/installments");
    expect(await installmentIneligibility(localDb, member)).toMatch(/expiré/);

    await expect(markInstallmentRefunded(member, plan.id)).rejects.toThrow(
      "Seul un administrateur",
    );
    await markInstallmentRefunded(admin, plan.id);
    expect((await planOf(member)).refundedAt).not.toBeNull();
    await expect(markInstallmentRefunded(admin, plan.id)).rejects.toThrow(
      "déjà remboursée",
    );
  });

  it("reminds the member a few days before the deadline, once", async () => {
    const { processInstallmentDeadlines } =
      await import("@/services/subscriptions/installments");
    const member = await makeProfile("ama");
    const plan = await openPlan(member);
    await confirmDeposit(member, plan.id, 4000);
    await localDb
      .update(schema.installmentPlans)
      .set({ deadlineAt: new Date(Date.now() + 5 * DAY_MS) })
      .where(eq(schema.installmentPlans.id, plan.id));

    sentEmails.length = 0;
    await processInstallmentDeadlines();
    const reminders = sentEmails.filter((e) => e.to === "ama@example.test");
    expect(reminders).toHaveLength(1);
    expect(reminders[0].html).toContain(F(15500));

    await processInstallmentDeadlines();
    expect(sentEmails.filter((e) => e.to === "ama@example.test")).toHaveLength(
      1,
    );
  });
});
