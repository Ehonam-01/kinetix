// SasPay (other countries, bank cards), end to end against a disposable
// pglite database with SasPay's HTTP API faked: the hosted checkout is
// created for "Autre pays", the webhook signature is checked like SasPay
// documents it, and a paid session confirms the subscription (or an
// installment deposit) through the same path as any other provider —
// only on what SasPay's API reports, never with a wrong amount.
import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
process.env.SASPAY_SECRET_KEY = "sk_test_kinetix";
process.env.SASPAY_WEBHOOK_SECRET = "whsec_kinetix";
process.env.SITE_URL ??= "https://kinetix.example";

// SasPay's API as seen by the adapter: sessions by id.
const sessions = new Map<
  string,
  { amount: string; status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" }
>();
const requests: { url: string; init?: RequestInit }[] = [];
vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200 });
    if (url.endsWith("/checkout-sessions/") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const id = randomUUID();
      sessions.set(id, { amount: body.amount, status: "PENDING" });
      // Enveloped, as SasPay documents its responses.
      return json({
        success: true,
        code: 201,
        data: {
          id,
          checkout_url: `https://pay.saspay.me/checkout/${id}`,
          amount: body.amount,
          currency: "XOF",
          status: "PENDING",
        },
      });
    }
    const status = url.match(/checkout-sessions\/([^/]+)\/status\/$/);
    if (status) {
      return json({ id: status[1], status: sessions.get(status[1])?.status });
    }
    const detail = url.match(/checkout-sessions\/([^/]+)\/$/);
    if (detail) {
      const s = sessions.get(detail[1]);
      return json({ id: detail[1], amount: s?.amount, status: s?.status });
    }
    return new Response("not found", { status: 404 });
  }),
);

async function makeMember(label: string) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `Membre ${label}`,
    status: "PENDING_PAYMENT",
  });
  return id;
}

function sign(body: string, timestamp: number, secret = "whsec_kinetix") {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

describe("SasPay", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  afterEach(() => {
    requests.length = 0;
  });

  it("checks webhook signatures the way SasPay documents them", async () => {
    const { verifySaspayWebhook } = await import("@/services/payments/saspay");
    const body = '{"event":"transaction.success","data":{"id":"t1"}}';
    const now = 1_790_000_000;
    expect(() =>
      verifySaspayWebhook(
        body,
        sign(body, now),
        String(now),
        "whsec_kinetix",
        now,
      ),
    ).not.toThrow();
    // Tampered body, wrong secret, too old, missing headers: refused.
    expect(() =>
      verifySaspayWebhook(
        body + " ",
        sign(body, now),
        String(now),
        "whsec_kinetix",
        now,
      ),
    ).toThrow("invalide");
    expect(() =>
      verifySaspayWebhook(
        body,
        sign(body, now, "autre"),
        String(now),
        "whsec_kinetix",
        now,
      ),
    ).toThrow("invalide");
    expect(() =>
      verifySaspayWebhook(
        body,
        sign(body, now - 600),
        String(now - 600),
        "whsec_kinetix",
        now,
      ),
    ).toThrow("hors délai");
    expect(() =>
      verifySaspayWebhook(body, null, null, "whsec_kinetix", now),
    ).toThrow("sans signature");
  });

  it("maps session statuses", async () => {
    const { toPaymentStatus } = await import("@/services/payments/saspay");
    expect(toPaymentStatus("PAID")).toBe("CONFIRMED");
    expect(toPaymentStatus("EXPIRED")).toBe("FAILED");
    expect(toPaymentStatus("CANCELLED")).toBe("FAILED");
    expect(toPaymentStatus("PENDING")).toBe("PENDING");
  });

  it("sends 'Autre pays' to SasPay's checkout, and confirms the subscription once paid", async () => {
    const { initiateSubscriptionPayment } =
      await import("@/services/subscriptions/initiate-subscription-payment");
    const { reconcilePendingSaspayPayments } =
      await import("@/services/payments/saspay-reconcile");
    const member = await makeMember("kwame");

    const intent = await initiateSubscriptionPayment({
      buyerUserId: member,
      email: "kwame@example.test",
      fullName: "Kwame Mensah",
      returnUrl: "https://kinetix.example/dashboard/subscription",
      country: "OTHER",
    });
    expect(intent.checkoutUrl).toMatch(
      /^https:\/\/pay\.saspay\.me\/checkout\//,
    );
    expect(intent.payment).toMatchObject({
      provider: "SASPAY",
      status: "PENDING",
    });
    const sent = JSON.parse(String(requests[0].init?.body));
    expect(sent).toMatchObject({
      currency: "XOF",
      amount: `${intent.payment.amount}.00`,
      customer_email: "kwame@example.test",
      customer_name: "Kwame Mensah",
    });
    expect(
      (requests[0].init?.headers as Record<string, string>).Authorization,
    ).toBe("Bearer sk_test_kinetix");

    // Not paid yet: nothing happens.
    expect(await reconcilePendingSaspayPayments()).toEqual({
      confirmed: 0,
      failed: 0,
    });

    sessions.get(intent.payment.providerReference!)!.status = "PAID";
    expect(await reconcilePendingSaspayPayments()).toEqual({
      confirmed: 1,
      failed: 0,
    });
    const subscription = await localDb.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, member),
    });
    expect(subscription).toBeDefined();
    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, member),
    });
    expect(profile.status).toBe("ACTIVE");
  });

  it("never confirms a session paid for another amount, and fails an expired one", async () => {
    const { initiateSubscriptionPayment } =
      await import("@/services/subscriptions/initiate-subscription-payment");
    const { reconcilePendingSaspayPayments } =
      await import("@/services/payments/saspay-reconcile");
    const tampered = await makeMember("tamper");
    const expired = await makeMember("expire");
    const base = {
      returnUrl: "https://kinetix.example/dashboard/subscription",
      country: "OTHER",
    };
    const a = await initiateSubscriptionPayment({
      ...base,
      buyerUserId: tampered,
      email: "t@example.test",
      fullName: "T T",
    });
    const b = await initiateSubscriptionPayment({
      ...base,
      buyerUserId: expired,
      email: "e@example.test",
      fullName: "E E",
    });
    sessions.set(a.payment.providerReference!, {
      amount: "100.00",
      status: "PAID",
    });
    sessions.get(b.payment.providerReference!)!.status = "EXPIRED";

    expect(await reconcilePendingSaspayPayments()).toEqual({
      confirmed: 0,
      failed: 1,
    });
    const [pa, pb] = await Promise.all(
      [a, b].map((x) =>
        localDb.query.payments.findFirst({
          where: eq(schema.payments.id, x.payment.id),
        }),
      ),
    );
    expect(pa.status).toBe("PENDING");
    expect(pb.status).toBe("FAILED");
  });

  it("works for an installment deposit too", async () => {
    const { initiateInstallmentDeposit } =
      await import("@/services/subscriptions/installments");
    const { reconcilePendingSaspayPayments } =
      await import("@/services/payments/saspay-reconcile");
    const member = await makeMember("ama");
    const intent = await initiateInstallmentDeposit({
      buyerUserId: member,
      email: "ama@example.test",
      fullName: "Ama Test",
      returnUrl: "https://kinetix.example/dashboard/subscription",
      amount: 5000,
      country: "OTHER",
      operator: "",
      phone: "",
    });
    expect(intent.payment).toMatchObject({
      provider: "SASPAY",
      purpose: "INSTALLMENT",
      amount: 5000,
    });
    sessions.get(intent.payment.providerReference!)!.status = "PAID";
    await reconcilePendingSaspayPayments();
    const plan = await localDb.query.installmentPlans.findFirst({
      where: eq(schema.installmentPlans.userId, member),
    });
    expect(plan).toMatchObject({ status: "OPEN", paidAmount: 5000 });
  });
});
