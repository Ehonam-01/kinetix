// The subscription grace-period rule, end to end against a disposable
// pglite database (every real migration applied, nothing shared touched):
// paid period -> GRACE_PERIOD_DAYS of kept access after expiry -> account
// deactivated, only an admin can reactivate. Only the Supabase session is
// faked (who's signed in) — requireUser/requireActiveMember, the status
// calculation, course access and the renewal math all run for real.
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
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
let signedInUserId: string | null = null;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: signedInUserId
            ? { id: signedInUserId, user_metadata: {} }
            : null,
        },
      }),
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const DAY_MS = 24 * 60 * 60 * 1000;

async function makeMember(label: string, expiresInDays: number | null) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `Membre ${label}`,
    status: "ACTIVE",
  });
  if (expiresInDays !== null) {
    const [payment] = await localDb
      .insert(schema.payments)
      .values({
        beneficiaryUserId: id,
        purpose: "SUBSCRIPTION",
        method: "ADMIN_CREDIT",
        amount: 300,
        status: "CONFIRMED",
        idempotencyKey: `TEST:${randomUUID()}`,
      })
      .returning();
    await localDb.insert(schema.subscriptions).values({
      userId: id,
      paymentId: payment.id,
      expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
      pricePaid: 300,
      businessVolume: 15,
    });
  }
  return id;
}

async function latestExpiry(userId: string): Promise<Date> {
  const row = await localDb.query.subscriptions.findFirst({
    where: eq(schema.subscriptions.userId, userId),
    orderBy: desc(schema.subscriptions.expiresAt),
  });
  return row.expiresAt;
}

// next/navigation's redirect() throws an error whose digest starts with
// NEXT_REDIRECT — that's how a blocked action shows up here.
async function expectRedirect(promise: Promise<unknown>) {
  await expect(promise).rejects.toMatchObject({
    digest: expect.stringMatching(/^NEXT_REDIRECT/),
  });
}

describe("subscription grace period (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("computes the three states: paid, grace, deactivated", async () => {
    const { getSubscriptionStatus, hasActiveSubscription } = await import(
      "@/repositories/subscriptions"
    );
    const paid = await makeMember("paid", 10);
    const grace = await makeMember("grace", -3);
    const deactivated = await makeMember("deact", -8);
    const never = await makeMember("never", null);

    const p = await getSubscriptionStatus(localDb, paid);
    expect(p).toMatchObject({ active: true, inGracePeriod: false, frozen: false });
    expect(await hasActiveSubscription(localDb, paid)).toBe(true);

    const g = await getSubscriptionStatus(localDb, grace);
    expect(g).toMatchObject({
      active: false,
      inGracePeriod: true,
      graceDaysLeft: 4,
      frozen: false,
    });
    expect(await hasActiveSubscription(localDb, grace)).toBe(true);

    const d = await getSubscriptionStatus(localDb, deactivated);
    expect(d).toMatchObject({
      active: false,
      inGracePeriod: false,
      frozen: true,
      permanentlyFrozen: true,
    });
    expect(await hasActiveSubscription(localDb, deactivated)).toBe(false);

    const n = await getSubscriptionStatus(localDb, never);
    expect(n).toMatchObject({ active: false, inGracePeriod: false, frozen: false });
  });

  it("member actions work during the grace period and are refused once deactivated", async () => {
    const { requireActiveMember } = await import("@/services/auth/current-user");
    const { lookupRecipientAction } = await import(
      "@/app/dashboard/transfer/actions"
    );

    signedInUserId = await makeMember("graceact", -2);
    await expect(requireActiveMember()).resolves.toBeTruthy();
    await expect(lookupRecipientAction("personne_xyz")).resolves.toEqual({
      fullName: null,
    });

    signedInUserId = await makeMember("deadact", -9);
    await expectRedirect(requireActiveMember());
    await expectRedirect(lookupRecipientAction("personne_xyz"));
  });

  it("a deactivated member can no longer pay on their own", async () => {
    const { subscribeAction } = await import(
      "@/app/dashboard/subscription/actions"
    );
    const { DEACTIVATED_ACCOUNT_MESSAGE } = await import(
      "@/services/auth/current-user"
    );
    signedInUserId = await makeMember("nopay", -10);
    const result = await subscribeAction("TG", "TOGOCELL", "90000000");
    expect(result?.error).toBe(DEACTIVATED_ACCOUNT_MESSAGE);
    const payments = await localDb.query.payments.findMany({
      where: eq(schema.payments.beneficiaryUserId, signedInUserId),
    });
    expect(payments).toHaveLength(1); // only the seeded, already-confirmed one
  });

  it("renewing during the grace period continues from the previous expiry", async () => {
    const { confirmSubscriptionPurchase } = await import(
      "@/services/subscriptions/confirm-subscription-payment"
    );
    const member = await makeMember("renew", -3);
    const previousExpiry = await latestExpiry(member);
    const [payment] = await localDb
      .insert(schema.payments)
      .values({
        beneficiaryUserId: member,
        purpose: "SUBSCRIPTION",
        method: "WALLET",
        amount: 300,
        status: "PENDING",
        idempotencyKey: `TEST:${randomUUID()}`,
      })
      .returning();
    await localDb.transaction((tx: unknown) =>
      confirmSubscriptionPurchase(tx as never, payment.id),
    );

    const renewed = await latestExpiry(member);
    const expected = new Date(previousExpiry);
    expected.setFullYear(expected.getFullYear() + 1);
    expect(renewed.getTime()).toBe(expected.getTime());
  });

  it("an admin reactivating a deactivated account starts a fresh year from today", async () => {
    const { grantSubscriptionCredit } = await import(
      "@/services/subscriptions/grant-subscription-credit"
    );
    const { getSubscriptionStatus } = await import("@/repositories/subscriptions");
    const admin = await makeMember("admin", null);
    await localDb
      .update(schema.profiles)
      .set({ role: "ADMIN" })
      .where(eq(schema.profiles.id, admin));
    const member = await makeMember("reactivate", -30);
    expect((await getSubscriptionStatus(localDb, member)).frozen).toBe(true);

    const before = Date.now();
    await grantSubscriptionCredit(admin, member);

    const status = await getSubscriptionStatus(localDb, member);
    expect(status).toMatchObject({ active: true, frozen: false });
    const oneYearFromBefore = new Date(before);
    oneYearFromBefore.setFullYear(oneYearFromBefore.getFullYear() + 1);
    expect(
      Math.abs(status.expiresAt!.getTime() - oneYearFromBefore.getTime()),
    ).toBeLessThan(60_000);
  });
});
