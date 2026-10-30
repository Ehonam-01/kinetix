// An admin validating a first subscription for what the member really has,
// against a disposable pglite database with every real migration applied:
// the sponsor's direct commission follows that amount (zero included), the
// cagnotte and the balance are spent exactly once, and a renewal still
// leaves the balance alone.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { prorateCommission } from "@/lib/prorate-commission";
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

// simulation-helpers seeds a FIXED 500 F direct-sale rule, so a partial
// amount must scale it too.
const FULL_COMMISSION = 500;
let price: number;
let admin: string;

async function makeProfile(label: string, role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `Profil ${label}`,
    status: role === "ADMIN" ? "ACTIVE" : "PENDING_PAYMENT",
    role,
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
  // Only a member with a valid subscription earns (services/mlm/commission.ts).
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: sponsor,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount: price,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId: sponsor,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    pricePaid: price,
    businessVolume: 15,
  });
  const member = await makeProfile("membre");
  await localDb
    .insert(schema.sponsorships)
    .values({ userId: member, sponsorId: sponsor });
  return { sponsor, member };
}

function setBalance(userId: string, availableBalance: number) {
  return localDb
    .insert(schema.userBalances)
    .values({ userId, availableBalance });
}

async function directCommissions(sponsor: string) {
  const rows = await localDb.query.commissionEvents.findMany({
    where: and(
      eq(schema.commissionEvents.beneficiaryUserId, sponsor),
      eq(schema.commissionEvents.type, "DIRECT_SALE"),
    ),
  });
  return rows.map((r: { amount: number }) => r.amount);
}

function subscriptionOf(userId: string) {
  return localDb.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, userId),
  });
}

async function balanceOf(userId: string) {
  const row = await localDb.query.userBalances.findFirst({
    where: eq(schema.userBalances.userId, userId),
  });
  return row?.availableBalance ?? 0;
}

describe("admin subscription validation (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    await seedDefaultCommissionRules(db);
    const { getCurrentParameterValue } =
      await import("@/repositories/parameter-versions");
    price = await getCurrentParameterValue(db, "subscription.price_in_cfa");
    admin = await makeProfile("admin", "ADMIN");
  }, 120_000);

  it("zero on the account: activated, no direct commission", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { sponsor, member } = await makeSponsoredMember();

    await grantSubscriptionCredit(admin, member);

    expect(await subscriptionOf(member)).toMatchObject({
      pricePaid: 0,
      ambassadorUserId: sponsor,
    });
    expect(
      await localDb.query.profiles.findFirst({
        where: eq(schema.profiles.id, member),
      }),
    ).toMatchObject({ status: "ACTIVE" });
    expect(await directCommissions(sponsor)).toEqual([]);
  });

  it("a partial balance is spent and the commission is prorated", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { sponsor, member } = await makeSponsoredMember();
    const available = Math.floor(price / 2);
    await setBalance(member, available);

    await grantSubscriptionCredit(admin, member);

    expect(await balanceOf(member)).toBe(0);
    expect((await subscriptionOf(member)).pricePaid).toBe(available);
    expect(await directCommissions(sponsor)).toEqual([
      prorateCommission(FULL_COMMISSION, available, price),
    ]);
    const [debit] = await localDb.query.financialTransactions.findMany({
      where: and(
        eq(schema.financialTransactions.userId, member),
        eq(schema.financialTransactions.type, "PAYMENT"),
      ),
    });
    expect(debit.amount).toBe(-available);
  });

  it("uses the cagnotte for the sponsor, and it can't be refunded too", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { sponsor, member } = await makeSponsoredMember();
    const deposits = Math.floor(price / 4);
    const [plan] = await localDb
      .insert(schema.installmentPlans)
      .values({ userId: member, targetAmount: price, paidAmount: deposits })
      .returning();

    await grantSubscriptionCredit(admin, member);

    const closed = await localDb.query.installmentPlans.findFirst({
      where: eq(schema.installmentPlans.id, plan.id),
    });
    expect(closed).toMatchObject({ status: "COMPLETED", refundAmount: null });
    expect((await subscriptionOf(member)).pricePaid).toBe(deposits);
    expect(await directCommissions(sponsor)).toEqual([
      prorateCommission(FULL_COMMISSION, deposits, price),
    ]);
  });

  it("money received off-site counts, and spares the balance", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { sponsor, member } = await makeSponsoredMember();
    await setBalance(member, 5000);

    await grantSubscriptionCredit(admin, member, price);

    expect(await balanceOf(member)).toBe(5000);
    expect(await directCommissions(sponsor)).toEqual([FULL_COMMISSION]);
  });

  it("never takes more than the price from the balance", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { member } = await makeSponsoredMember();
    await setBalance(member, price + 1000);

    await grantSubscriptionCredit(admin, member);

    expect(await balanceOf(member)).toBe(1000);
    expect((await subscriptionOf(member)).pricePaid).toBe(price);
  });

  it("leaves the balance alone on a renewal", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { member } = await makeSponsoredMember();
    await grantSubscriptionCredit(admin, member);
    await setBalance(member, 8000);

    await grantSubscriptionCredit(admin, member);

    expect(await balanceOf(member)).toBe(8000);
  });

  it("refuses a non-admin and a bad amount", async () => {
    const { grantSubscriptionCredit } =
      await import("@/services/subscriptions/grant-subscription-credit");
    const { member } = await makeSponsoredMember();
    await expect(grantSubscriptionCredit(member, member)).rejects.toThrow(
      "Seul un administrateur",
    );
    await expect(grantSubscriptionCredit(admin, member, -1)).rejects.toThrow(
      "invalide",
    );
  });

  it("prorates any commission to the share paid", () => {
    expect(prorateCommission(500, 0, 10_000)).toBe(0);
    expect(prorateCommission(500, 5000, 10_000)).toBe(250);
    expect(prorateCommission(500, 20_000, 10_000)).toBe(500);
    // 15 % of 19 500 F, on a cagnotte of 4 000 F: 15 % of 4 000 F.
    expect(prorateCommission(2925, 4000, 19_500)).toBe(600);
  });
});
