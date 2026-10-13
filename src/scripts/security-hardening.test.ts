// Checks for the security audit of 2026-10-13 (SEC-xx in SECURITY.md), run
// against a disposable pglite database with every real migration applied.
//
// pglite has a single connection, so two confirmations can't truly run at
// the same instant here: what's checked is the outcome of the same payment
// confirmed through two paths (two dedupe keys), and the database-level
// guard (one subscription per payment) that makes a concurrent double
// confirmation roll back even if the row lock were ever bypassed.
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
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: { sendEmail: async () => {} },
}));
process.env.SITE_URL ??= "https://kinetix.example";

async function makeProfile(label: string) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `${label} Test`,
    status: "PENDING_PAYMENT",
  });
  return id;
}

async function pendingPayment(
  userId: string,
  values: Partial<typeof schema.payments.$inferInsert> = {},
) {
  const reference = `ref-${randomUUID()}`;
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: userId,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount: 15000,
      provider: "PAYDUNYA",
      providerReference: reference,
      idempotencyKey: `TEST:${randomUUID()}`,
      ...values,
    })
    .returning();
  return payment;
}

async function deliver(
  reference: string,
  status: "CONFIRMED" | "FAILED",
  dedupeKey: string,
  amount?: number,
) {
  const { processWebhookEvent } =
    await import("@/services/payments/process-webhook-event");
  return localDb.transaction((tx: never) =>
    processWebhookEvent(tx, {
      providerReference: reference,
      status,
      eventType: "test",
      dedupeKey,
      raw: {},
      ...(amount !== undefined ? { amount } : {}),
    }),
  );
}

const paymentOf = (id: string) =>
  localDb.query.payments.findFirst({ where: eq(schema.payments.id, id) });
const subscriptionsOf = (userId: string) =>
  localDb.query.subscriptions.findMany({
    where: eq(schema.subscriptions.userId, userId),
  });

describe("security hardening (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  describe("SEC-01: a payment confirmed by two paths is applied once", () => {
    it("creates a single subscription", async () => {
      const member = await makeProfile("afi");
      const payment = await pendingPayment(member);

      // The provider's webhook, then the member's own status check.
      await deliver(
        payment.providerReference,
        "CONFIRMED",
        `${payment.providerReference}:CONFIRMED`,
      );
      await deliver(
        payment.providerReference,
        "CONFIRMED",
        `poll-reconcile:${payment.id}:CONFIRMED`,
      );

      expect(await subscriptionsOf(member)).toHaveLength(1);
      expect((await paymentOf(payment.id)).status).toBe("CONFIRMED");
    });

    it("counts an installment deposit once", async () => {
      const member = await makeProfile("kossi");
      const [plan] = await localDb
        .insert(schema.installmentPlans)
        .values({ userId: member, targetAmount: 15000 })
        .returning();
      const deposit = await pendingPayment(member, {
        purpose: "INSTALLMENT",
        amount: 5000,
        metadata: { installmentPlanId: plan.id },
      });

      await deliver(
        deposit.providerReference,
        "CONFIRMED",
        `${deposit.providerReference}:CONFIRMED`,
      );
      await deliver(
        deposit.providerReference,
        "CONFIRMED",
        `poll-reconcile:${deposit.id}:CONFIRMED`,
      );

      const after = await localDb.query.installmentPlans.findFirst({
        where: eq(schema.installmentPlans.id, plan.id),
      });
      expect(after.paidAmount).toBe(5000);
    });

    it("refuses a second subscription for the same payment in the database", async () => {
      const member = await makeProfile("ama");
      const payment = await pendingPayment(member);
      await deliver(
        payment.providerReference,
        "CONFIRMED",
        `${payment.providerReference}:CONFIRMED`,
      );
      const [existing] = await subscriptionsOf(member);

      await expect(
        localDb.insert(schema.subscriptions).values({
          userId: member,
          paymentId: payment.id,
          expiresAt: existing.expiresAt,
          pricePaid: 15000,
          businessVolume: 15,
        }),
      ).rejects.toThrow();
    });
  });

  describe("SEC-06: a confirmation for another amount is never applied", () => {
    it("leaves the payment pending and grants nothing", async () => {
      const member = await makeProfile("yao");
      const payment = await pendingPayment(member, { provider: "BICTORYS" });

      await deliver(
        payment.providerReference,
        "CONFIRMED",
        `${payment.providerReference}:succeeded`,
        100,
      );

      expect((await paymentOf(payment.id)).status).toBe("PENDING");
      expect(await subscriptionsOf(member)).toHaveLength(0);
    });

    it("still applies a confirmation for the right amount", async () => {
      const member = await makeProfile("esi");
      const payment = await pendingPayment(member, { provider: "BICTORYS" });

      await deliver(
        payment.providerReference,
        "CONFIRMED",
        `${payment.providerReference}:succeeded`,
        15000,
      );

      expect((await paymentOf(payment.id)).status).toBe("CONFIRMED");
      expect(await subscriptionsOf(member)).toHaveLength(1);
    });
  });

  describe("SEC-07: a confirmed payment never goes back to FAILED", () => {
    it("ignores a late failure event", async () => {
      const member = await makeProfile("kofi");
      const payment = await pendingPayment(member);
      await deliver(
        payment.providerReference,
        "CONFIRMED",
        `${payment.providerReference}:CONFIRMED`,
      );

      await deliver(
        payment.providerReference,
        "FAILED",
        `${payment.providerReference}:FAILED`,
      );

      expect((await paymentOf(payment.id)).status).toBe("CONFIRMED");
    });

    it("still fails a payment that was pending", async () => {
      const member = await makeProfile("adjo");
      const payment = await pendingPayment(member);

      await deliver(
        payment.providerReference,
        "FAILED",
        `${payment.providerReference}:FAILED`,
      );

      expect((await paymentOf(payment.id)).status).toBe("FAILED");
    });
  });
});
