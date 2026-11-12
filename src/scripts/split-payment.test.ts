// Paying the first subscription in 3 times (lib/split-payment.ts,
// services/subscriptions/installments.ts), against a disposable pglite
// database with every real migration applied: the first tranche opens the
// subscription until the deadline without any commission, only the next
// tranche or the whole rest can be paid, no full subscription can be paid
// on top, the last tranche extends it to a year and pays the sponsor once,
// and past the deadline the plan stays open to be settled.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { splitPaymentChoices, splitTranches } from "@/lib/split-payment";
import {
  createSimulationDb,
  seedBaselineParameters,
  seedDefaultCommissionRules,
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
  resendEmailProvider: { sendEmail: async () => undefined },
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

const PRICE = 35_000;
const DAY_MS = 24 * 60 * 60 * 1000;
// simulation-helpers seeds a FIXED 500 F direct-sale rule.
const COMMISSION = 500;

describe("splitTranches / splitPaymentChoices", () => {
  it("25 000 F first, then the rest in two", () => {
    expect(splitTranches(35_000)).toEqual([25_000, 5_000, 5_000]);
    expect(splitTranches(36_001)).toEqual([25_000, 5_501, 5_500]);
    expect(splitTranches(25_000)).toBeNull();
  });

  it("the first tranche alone, then a tranche or everything left", () => {
    expect(splitPaymentChoices(35_000, 0, 0)).toEqual([25_000]);
    // The first tranche still being confirmed: nothing else meanwhile.
    expect(splitPaymentChoices(35_000, 0, 25_000)).toEqual([]);
    expect(splitPaymentChoices(35_000, 25_000, 0)).toEqual([5_000, 10_000]);
    expect(splitPaymentChoices(35_000, 30_000, 0)).toEqual([5_000]);
    expect(splitPaymentChoices(35_000, 25_000, 5_000)).toEqual([5_000]);
    expect(splitPaymentChoices(35_000, 35_000, 0)).toEqual([]);
  });
});

async function makeProfile(label: string) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `Profil ${label}`,
    status: "PENDING_PAYMENT",
  });
  return id;
}

async function makeSponsoredMember() {
  const sponsor = await makeProfile("parrain");
  await localDb
    .update(schema.profiles)
    .set({ status: "ACTIVE" })
    .where(eq(schema.profiles.id, sponsor));
  await localDb.insert(schema.ambassadorProfiles).values({
    userId: sponsor,
    referralCode: `p_${sponsor.slice(0, 8)}`,
    termsAcceptedAt: new Date(),
    termsVersion: "test",
  });
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: sponsor,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount: PRICE,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId: sponsor,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 300 * DAY_MS),
    pricePaid: PRICE,
    businessVolume: 15,
  });
  const member = await makeProfile("membre");
  await localDb
    .insert(schema.sponsorships)
    .values({ userId: member, sponsorId: sponsor });
  return { sponsor, member };
}

const base = (member: string) => ({
  buyerUserId: member,
  email: "membre@example.test",
  fullName: "Membre Test",
  returnUrl: "https://kinetix.example/dashboard/subscription",
  country: "TG",
  operator: "TMONEY",
  phone: "90000000",
});

// Starts a tranche the way the member does, then confirms it through the
// webhook path a real one takes. Returns the webhook event, to redeliver.
async function payTranche(member: string, amount: number) {
  const { initiateInstallmentDeposit } =
    await import("@/services/subscriptions/installments");
  const { processWebhookEvent } =
    await import("@/services/payments/process-webhook-event");
  const intent = await initiateInstallmentDeposit({ ...base(member), amount });
  const event = {
    providerReference: intent.payment.providerReference!,
    status: "CONFIRMED" as const,
    eventType: "test",
    dedupeKey: `test:${intent.payment.id}`,
    raw: {},
  };
  await localDb.transaction((tx: never) => processWebhookEvent(tx, event));
  return event;
}

const planOf = (userId: string) =>
  localDb.query.installmentPlans.findFirst({
    where: eq(schema.installmentPlans.userId, userId),
  });
const subscriptionsOf = (userId: string) =>
  localDb.query.subscriptions.findMany({
    where: eq(schema.subscriptions.userId, userId),
  });

async function directCommissions(sponsor: string) {
  const rows = await localDb.query.commissionEvents.findMany({
    where: and(
      eq(schema.commissionEvents.beneficiaryUserId, sponsor),
      eq(schema.commissionEvents.type, "DIRECT_SALE"),
    ),
  });
  return rows.map((r: { amount: number }) => r.amount);
}

describe("payment in 3 times (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    await seedDefaultCommissionRules(db);
    await db.insert(schema.parameterVersions).values({
      parameterKey: "subscription.price_in_cfa",
      value: PRICE,
      effectiveFrom: new Date(Date.now() + 1000),
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }, 120_000);

  it("opens on the first tranche and pays the sponsor only once settled", async () => {
    const { processWebhookEvent } =
      await import("@/services/payments/process-webhook-event");
    const { initiateInstallmentDeposit } =
      await import("@/services/subscriptions/installments");
    const { initiateSubscriptionPayment } =
      await import("@/services/subscriptions/initiate-subscription-payment");
    const { sponsor, member } = await makeSponsoredMember();

    // Only the first tranche can start it.
    await expect(
      initiateInstallmentDeposit({ ...base(member), amount: 5_000 }),
    ).rejects.toThrow("25");
    await payTranche(member, 25_000);

    const plan = await planOf(member);
    expect(plan).toMatchObject({
      split: true,
      status: "OPEN",
      paidAmount: 25_000,
    });
    const [opened] = await subscriptionsOf(member);
    // Open right away, until the deadline, and the account with it.
    expect(opened.pricePaid).toBe(25_000);
    expect(opened.expiresAt.getTime()).toBe(plan.deadlineAt.getTime());
    expect(opened.ambassadorUserId).toBe(sponsor);
    expect(
      await localDb.query.profiles.findFirst({
        where: eq(schema.profiles.id, member),
      }),
    ).toMatchObject({ status: "ACTIVE" });
    expect(await directCommissions(sponsor)).toEqual([]);

    // A tranche or everything left, nothing in between; no full
    // subscription on top.
    await expect(
      initiateInstallmentDeposit({ ...base(member), amount: 7_000 }),
    ).rejects.toThrow("tout régler");
    await expect(initiateSubscriptionPayment(base(member))).rejects.toThrow(
      "en 3 fois",
    );

    await payTranche(member, 5_000);
    expect((await subscriptionsOf(member))[0].pricePaid).toBe(30_000);
    expect(await directCommissions(sponsor)).toEqual([]);

    const last = await payTranche(member, 5_000);
    const subscriptions = await subscriptionsOf(member);
    expect(subscriptions).toHaveLength(1);
    const [settled] = subscriptions;
    expect(settled.pricePaid).toBe(PRICE);
    const year = new Date(settled.startedAt);
    year.setFullYear(year.getFullYear() + 1);
    expect(settled.expiresAt.getTime()).toBe(year.getTime());
    expect(await planOf(member)).toMatchObject({ status: "COMPLETED" });
    expect(await directCommissions(sponsor)).toEqual([COMMISSION]);

    // The last tranche's webhook delivered again: counted once.
    await localDb.transaction((tx: never) =>
      processWebhookEvent(tx, {
        ...last,
        dedupeKey: `${last.dedupeKey}:again`,
      }),
    );
    expect(await directCommissions(sponsor)).toEqual([COMMISSION]);
    expect((await planOf(member)).paidAmount).toBe(PRICE);
  });

  it("past the deadline, stays open to be settled, never refunded", async () => {
    const { processInstallmentDeadlines } =
      await import("@/services/subscriptions/installments");
    const { getSubscriptionStatus } =
      await import("@/repositories/subscriptions");
    const { member, sponsor } = await makeSponsoredMember();
    await payTranche(member, 25_000);

    // Four months later, nothing more paid.
    const past = new Date(Date.now() - 30 * DAY_MS);
    const plan = await planOf(member);
    await localDb
      .update(schema.installmentPlans)
      .set({ deadlineAt: past })
      .where(eq(schema.installmentPlans.id, plan.id));
    await localDb
      .update(schema.subscriptions)
      .set({ expiresAt: past })
      .where(eq(schema.subscriptions.userId, member));

    await processInstallmentDeadlines();
    expect(await planOf(member)).toMatchObject({
      status: "OPEN",
      refundAmount: null,
    });
    expect((await getSubscriptionStatus(localDb, member)).frozen).toBe(true);

    // Settling it all at once brings the account back for a year.
    await payTranche(member, 10_000);
    expect(await planOf(member)).toMatchObject({ status: "COMPLETED" });
    expect((await getSubscriptionStatus(localDb, member)).active).toBe(true);
    expect(await directCommissions(sponsor)).toEqual([COMMISSION]);
  });
});
