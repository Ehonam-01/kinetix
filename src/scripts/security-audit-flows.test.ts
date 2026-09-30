// End-to-end checks for the security audit fixes (reports/
// AUDIT_SECURITE_2026-09-26.md) — the real services, server actions and
// route handlers run against a disposable in-memory Postgres (pglite, every
// real migration applied, never touches the network or the shared
// database). Only the outside world is faked: payment providers answer
// through a stubbed fetch the test controls, and outgoing emails are
// captured instead of sent (that's also how the OTP codes are read back).
import { createHash, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
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

type SentEmail = { to: string; subject: string; html: string };
const sentEmails: SentEmail[] = [];
// Simulates Resend being down.
let emailsFail = false;
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: SentEmail) => {
      if (emailsFail) throw new Error("Resend indisponible");
      sentEmails.push(input);
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentUser: any = null;
vi.mock("@/services/auth/current-user", () => ({
  requireUser: async () => currentUser,
  requireAdmin: async () => currentUser,
  getCurrentUser: async () => currentUser,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

type FakeResponse = { status: number; body: unknown; delayMs?: number };
let fetchHandler: (url: string, init?: RequestInit) => FakeResponse = () => {
  throw new Error("Aucun appel réseau attendu dans ce test.");
};
const fetchCalls: { url: string; body: unknown }[] = [];
vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  fetchCalls.push({
    url,
    body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
  });
  const { status, body, delayMs } = fetchHandler(url, init);
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
});

// Same fake key vitest.config.ts injects — the PayDunya IPN "hash" is
// SHA-512 of it.
const PAYDUNYA_HASH = createHash("sha512")
  .update("test_unit_test_fake_master_key")
  .digest("hex");

async function makeUser(
  label: string,
  options: { balance?: number; role?: "ADMIN"; fullName?: string } = {},
) {
  const id = randomUUID();
  const username = `${label}_${id.slice(0, 6)}`;
  const email = `${username}@example.test`;
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, email],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username,
    fullName: options.fullName ?? `Membre ${label}`,
    status: "ACTIVE",
    role: options.role ?? "USER",
  });
  if (options.balance) {
    await localDb.insert(schema.userBalances).values({
      userId: id,
      availableBalance: options.balance,
    });
  }
  return { id, username, email };
}

function lastCodeSentTo(email: string): string {
  const mail = [...sentEmails].reverse().find((m) => m.to === email);
  const code = mail?.html.match(/font-size:1\.5em">(\d{6})</)?.[1];
  if (!code) throw new Error(`Aucun code envoyé à ${email}`);
  return code;
}

function wrongCode(code: string) {
  return code === "000000" ? "111111" : "000000";
}

async function balanceOf(userId: string) {
  const row = await localDb.query.userBalances.findFirst({
    where: eq(schema.userBalances.userId, userId),
  });
  return row ?? { availableBalance: 0, pendingBalance: 0 };
}

async function insertPendingPayment(input: {
  userId: string;
  provider: "PAYDUNYA" | "BICTORYS";
  amount?: number;
  metadata?: Record<string, unknown>;
}) {
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: input.userId,
      purpose: "SUBSCRIPTION",
      method: "MOBILE_MONEY",
      amount: input.amount ?? 15000,
      provider: input.provider,
      providerReference: `tok-${randomUUID()}`,
      idempotencyKey: `TEST:${randomUUID()}`,
      status: "PENDING",
      metadata: input.metadata ?? null,
    })
    .returning();
  return payment;
}

async function paymentStatus(paymentId: string) {
  const row = await localDb.query.payments.findFirst({
    where: eq(schema.payments.id, paymentId),
  });
  return row.status;
}

describe("security audit fixes (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    await seedBaselineParameters(db);
  }, 120_000);

  it("H2 — 50 concurrent wrong OTP attempts never exceed the 5-attempt cap", async () => {
    const { initiateTransfer } =
      await import("@/services/wallet/initiate-transfer");
    const { confirmTransfer } =
      await import("@/services/wallet/confirm-transfer");
    const sender = await makeUser("sender", { balance: 10000 });
    const recipient = await makeUser("recipient");

    const transfer = await initiateTransfer(
      sender.id,
      recipient.username,
      1000,
    );
    const code = lastCodeSentTo(sender.email);

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () =>
        confirmTransfer(sender.id, transfer.id, wrongCode(code)),
      ),
    );
    const incorrect = results.filter(
      (r) => r.status === "rejected" && r.reason.message === "Code incorrect.",
    );
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(incorrect).toHaveLength(5);

    // Cap reached: even the right code is refused now, nothing moved.
    await expect(
      confirmTransfer(sender.id, transfer.id, code),
    ).rejects.toThrow();
    expect((await balanceOf(sender.id)).availableBalance).toBe(10000);
    expect((await balanceOf(recipient.id)).availableBalance).toBe(0);

    // A fresh transfer with the right code still goes through normally.
    const second = await initiateTransfer(sender.id, recipient.username, 1000);
    await confirmTransfer(sender.id, second.id, lastCodeSentTo(sender.email));
    expect((await balanceOf(sender.id)).availableBalance).toBe(9000);
    expect((await balanceOf(recipient.id)).availableBalance).toBe(1000);
  });

  it("H3 — only the wallet owner can confirm a third-party subscription payment", async () => {
    const { requestSubscriptionWithWallet } =
      await import("@/services/subscriptions/request-subscription-wallet");
    const { confirmSubscriptionWithWallet } =
      await import("@/services/subscriptions/confirm-subscription-wallet");
    const owner = await makeUser("owner", { balance: 20000 });
    const buyer = await makeUser("buyer");

    const request = await requestSubscriptionWithWallet({
      buyerUserId: buyer.id,
      walletUsername: owner.username,
    });
    const ownerEmail = [...sentEmails]
      .reverse()
      .find((m) => m.to === owner.email);
    expect(ownerEmail?.html).toContain("Transférer");
    expect(ownerEmail?.html).toContain("Ne communiquez jamais ce code");
    const code = lastCodeSentTo(owner.email);

    // The buyer, even holding the right code, is refused — and burns no attempt.
    await expect(
      confirmSubscriptionWithWallet(buyer.id, request.id, code),
    ).rejects.toThrow("Demande de souscription introuvable.");
    expect((await balanceOf(owner.id)).availableBalance).toBe(20000);

    // The owner, from their own session, can.
    await confirmSubscriptionWithWallet(owner.id, request.id, code);
    expect((await balanceOf(owner.id)).availableBalance).toBe(5000);
    const subscription = await localDb.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, buyer.id),
    });
    expect(subscription).toBeTruthy();
  });

  it("H3 — paying with your own wallet is unchanged", async () => {
    const { requestSubscriptionWithWallet } =
      await import("@/services/subscriptions/request-subscription-wallet");
    const { confirmSubscriptionWithWallet } =
      await import("@/services/subscriptions/confirm-subscription-wallet");
    const member = await makeUser("self", { balance: 20000 });

    const request = await requestSubscriptionWithWallet({
      buyerUserId: member.id,
      walletUsername: member.username,
    });
    await confirmSubscriptionWithWallet(
      member.id,
      request.id,
      lastCodeSentTo(member.email),
    );
    expect((await balanceOf(member.id)).availableBalance).toBe(5000);
  });

  it("H3 — a wallet can't be targeted more than 3 times an hour", async () => {
    const { requestSubscriptionWithWallet } =
      await import("@/services/subscriptions/request-subscription-wallet");
    const wallet = await makeUser("target", { balance: 100000 });
    const buyers = await Promise.all(
      [1, 2, 3, 4].map((n) => makeUser(`spam${n}`)),
    );

    for (const buyer of buyers.slice(0, 3)) {
      await requestSubscriptionWithWallet({
        buyerUserId: buyer.id,
        walletUsername: wallet.username,
      });
    }
    await expect(
      requestSubscriptionWithWallet({
        buyerUserId: buyers[3].id,
        walletUsername: wallet.username,
      }),
    ).rejects.toThrow("Trop de demandes");
  });

  describe("H4 — withdrawal approval", () => {
    async function confirmedWithdrawal(label: string) {
      const { requestWithdrawal } =
        await import("@/services/wallet/request-withdrawal");
      const { confirmWithdrawal } =
        await import("@/services/wallet/confirm-withdrawal");
      const member = await makeUser(label, { balance: 10000 });
      const request = await requestWithdrawal(
        member.id,
        5000,
        "+221770000000",
        "ORANGE_MONEY",
        "SN",
      );
      await confirmWithdrawal(
        member.id,
        request.id,
        lastCodeSentTo(member.email),
      );
      return request.id;
    }

    async function withdrawalRow(id: string) {
      return localDb.query.withdrawalRequests.findFirst({
        where: eq(schema.withdrawalRequests.id, id),
      });
    }

    async function balanceRow(requestId: string) {
      const row = await withdrawalRow(requestId);
      return localDb.query.userBalances.findFirst({
        where: eq(schema.userBalances.userId, row.userId),
      });
    }

    type Step =
      { status?: number; body: unknown; delayMs?: number } | "network";

    // Answers PayDunya's three disbursement endpoints; "network" simulates
    // a connection failure on that step.
    function paydunyaDisburse(steps: {
      invoice: Step;
      submit?: Step;
      check?: Step;
    }) {
      fetchHandler = (url) => {
        const step = url.endsWith("/get-invoice")
          ? steps.invoice
          : url.endsWith("/submit-invoice")
            ? steps.submit
            : url.endsWith("/check-status")
              ? steps.check
              : undefined;
        if (!step) throw new Error(`Appel inattendu : ${url}`);
        if (step === "network") throw new Error("réseau indisponible");
        return { ...step, status: step.status ?? 200 };
      };
    }

    const invoiceOk = (token: string): Step => ({
      body: { response_code: "00", disburse_token: token },
    });
    const statusIs = (status: string): Step => ({
      body: { response_code: "00", status },
    });

    function submitCallCount() {
      return fetchCalls.filter((c) => c.url.endsWith("/submit-invoice")).length;
    }

    it("a double click sends exactly one PayDunya disbursement", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw1");
      paydunyaDisburse({
        invoice: invoiceOk("tok-1"),
        submit: { body: { response_code: "00" }, delayMs: 50 },
        check: statusIs("pending"),
      });
      const before = submitCallCount();

      const results = await Promise.allSettled([
        approveWithdrawal(admin.id, requestId),
        approveWithdrawal(admin.id, requestId),
      ]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(submitCallCount() - before).toBe(1);
      const row = await withdrawalRow(requestId);
      expect(row.status).toBe("PROCESSING");
      expect(row.payoutProviderReference).toBe("tok-1");
      // Our own reference for the attempt is sent, so PayDunya itself
      // refuses to process it twice.
      const submit = fetchCalls
        .filter((c) => c.url.endsWith("/submit-invoice"))
        .at(-1);
      expect(submit?.body).toMatchObject({
        disburse_invoice: "tok-1",
        disburse_id: expect.stringContaining(requestId),
      });
    });

    it("an insufficient PayDunya balance puts the request back in the queue, with a clear reason", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw2");
      paydunyaDisburse({
        invoice: {
          body: { response_code: "4002", response_text: "Insufficient funds" },
        },
      });
      const before = submitCallCount();

      await expect(approveWithdrawal(admin.id, requestId)).rejects.toThrow();
      const row = await withdrawalRow(requestId);
      expect(row.status).toBe("PENDING_REVIEW");
      expect(row.payoutFailureReason).toContain("Solde PayDunya insuffisant");
      expect(submitCallCount() - before).toBe(0);
      expect((await balanceRow(requestId))?.pendingBalance).toBe(5000);
    });

    it("an unreachable callback URL is reported as such, not as a balance problem", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw2b");
      paydunyaDisburse({
        invoice: {
          body: {
            response_code: "4002",
            response_text: "the callback is not accessible",
          },
        },
      });

      await expect(approveWithdrawal(admin.id, requestId)).rejects.toThrow();
      const row = await withdrawalRow(requestId);
      expect(row.status).toBe("PENDING_REVIEW");
      expect(row.payoutFailureReason).toContain("URL de confirmation");
      expect(row.payoutFailureReason).not.toContain("Solde");
    });

    it("an uncertain outcome stays PROCESSING, can't be re-sent, and is settled by checking the status", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const { syncPaydunyaPayout } =
        await import("@/services/payments/sync-paydunya-payout");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw3");
      paydunyaDisburse({
        invoice: invoiceOk("tok-3"),
        submit: "network",
        check: "network",
      });
      const before = submitCallCount();

      await expect(approveWithdrawal(admin.id, requestId)).rejects.toThrow(
        "incertain",
      );
      let row = await withdrawalRow(requestId);
      expect(row.status).toBe("PROCESSING");
      expect(row.payoutProviderReference).toBe("tok-3");
      expect(row.payoutFailureReason).toContain("incertain");

      await expect(approveWithdrawal(admin.id, requestId)).rejects.toThrow(
        "n'est plus en attente",
      );
      expect(submitCallCount() - before).toBe(1);

      // "Vérifier le statut": PayDunya now reports success -> PAID.
      paydunyaDisburse({ invoice: "network", check: statusIs("success") });
      expect(await syncPaydunyaPayout("tok-3")).toBe("success");
      row = await withdrawalRow(requestId);
      expect(row.status).toBe("PAID");
      const balance = await balanceRow(requestId);
      expect(balance?.pendingBalance).toBe(0);
      expect(balance?.withdrawnBalance).toBe(5000);
    });

    it("a disbursement PayDunya reports successful right away is marked paid immediately", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw4");
      paydunyaDisburse({
        invoice: invoiceOk("tok-4"),
        submit: { body: { response_code: "00" } },
        check: statusIs("success"),
      });

      await approveWithdrawal(admin.id, requestId);
      expect((await withdrawalRow(requestId)).status).toBe("PAID");
    });

    it("a transfer the operator refuses goes back to the queue and can be retried", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw5");
      paydunyaDisburse({
        invoice: invoiceOk("tok-5"),
        submit: { body: { response_code: "00" } },
        check: statusIs("failed"),
      });

      await expect(approveWithdrawal(admin.id, requestId)).rejects.toThrow();
      let row = await withdrawalRow(requestId);
      expect(row.status).toBe("PENDING_REVIEW");
      expect(row.payoutFailureReason).toContain("refusé par l'opérateur");

      // Retry with a fresh attempt.
      paydunyaDisburse({
        invoice: invoiceOk("tok-5b"),
        submit: { body: { response_code: "00" } },
        check: statusIs("pending"),
      });
      await approveWithdrawal(admin.id, requestId);
      row = await withdrawalRow(requestId);
      expect(row.status).toBe("PROCESSING");
      expect(row.payoutProviderReference).toBe("tok-5b");
    });

    it("PayDunya's callback is only a signal: a forged one is ignored, a real one is re-checked", async () => {
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const { GET, POST } =
        await import("@/app/api/webhooks/providers/paydunya-payout/route");
      // PayDunya's reachability probe must get a success, or it refuses to
      // create the disbursement (4002 "the callback is not accessible").
      expect((await GET()).status).toBe(200);
      const admin = await makeUser("admin", { role: "ADMIN" });
      const requestId = await confirmedWithdrawal("withdraw6");
      paydunyaDisburse({
        invoice: invoiceOk("tok-6"),
        submit: { body: { response_code: "00" } },
        check: statusIs("pending"),
      });
      await approveWithdrawal(admin.id, requestId);

      const callback = (hash: string, status: string) =>
        POST(
          new Request(
            "http://localhost/api/webhooks/providers/paydunya-payout",
            {
              method: "POST",
              body: JSON.stringify({ hash, status, token: "tok-6" }),
            },
          ),
        );

      // Answered 200 (probe-friendly) but never acted on.
      expect((await callback("faux", "success")).status).toBe(200);
      expect((await withdrawalRow(requestId)).status).toBe("PROCESSING");

      // A genuine callback claiming success while PayDunya's API still says
      // pending: nothing is applied.
      paydunyaDisburse({ invoice: "network", check: statusIs("pending") });
      expect((await callback(PAYDUNYA_HASH, "success")).status).toBe(200);
      expect((await withdrawalRow(requestId)).status).toBe("PROCESSING");

      paydunyaDisburse({ invoice: "network", check: statusIs("success") });
      await callback(PAYDUNYA_HASH, "success");
      expect((await withdrawalRow(requestId)).status).toBe("PAID");
    });

    it("emails the member when a withdrawal is received, paid (once) or rejected", async () => {
      const { requestWithdrawal } =
        await import("@/services/wallet/request-withdrawal");
      const { confirmWithdrawal } =
        await import("@/services/wallet/confirm-withdrawal");
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const { rejectWithdrawal } =
        await import("@/services/admin/reject-withdrawal");
      const { syncPaydunyaPayout } =
        await import("@/services/payments/sync-paydunya-payout");
      const admin = await makeUser("admin", { role: "ADMIN" });
      const subjectsSentTo = (email: string) =>
        sentEmails.filter((m) => m.to === email).map((m) => m.subject);

      // Received, then paid right away — then PayDunya's callback confirms
      // the same transfer again: still a single "effectué" email.
      const paid = await makeUser("mailpaid", { balance: 10000 });
      const r1 = await requestWithdrawal(
        paid.id,
        5000,
        "+221770000001",
        "ORANGE_MONEY",
        "SN",
      );
      await confirmWithdrawal(paid.id, r1.id, lastCodeSentTo(paid.email));
      expect(subjectsSentTo(paid.email).at(-1)).toMatch(
        /^Demande de retrait de 5.000 F reçue$/,
      );
      paydunyaDisburse({
        invoice: invoiceOk("tok-mail"),
        submit: { body: { response_code: "00" } },
        check: statusIs("success"),
      });
      await approveWithdrawal(admin.id, r1.id);
      await syncPaydunyaPayout("tok-mail");
      const paidMails = sentEmails.filter(
        (m) => m.to === paid.email && m.subject.includes("effectué"),
      );
      expect(paidMails).toHaveLength(1);
      expect(paidMails[0].html).toContain("+221770000001");

      // Rejected: the admin's reason is shown, escaped.
      const rejected = await makeUser("mailrej", { balance: 10000 });
      const r2 = await requestWithdrawal(
        rejected.id,
        3000,
        "+221770000002",
        "ORANGE_MONEY",
        "SN",
      );
      await confirmWithdrawal(
        rejected.id,
        r2.id,
        lastCodeSentTo(rejected.email),
      );
      await rejectWithdrawal(admin.id, r2.id, "Numéro <b>incorrect</b>");
      const rejectMail = sentEmails
        .filter((m) => m.to === rejected.email)
        .at(-1)!;
      expect(rejectMail.subject).toMatch(/refusée$/);
      expect(rejectMail.html).toContain("Numéro &lt;b&gt;incorrect&lt;/b&gt;");
      expect(rejectMail.html).toContain("recrédité");

      // Resend down: the withdrawal is still paid, nothing thrown.
      const noMail = await makeUser("mailfail", { balance: 10000 });
      const r3 = await requestWithdrawal(
        noMail.id,
        2000,
        "+221770000003",
        "ORANGE_MONEY",
        "SN",
      );
      await confirmWithdrawal(noMail.id, r3.id, lastCodeSentTo(noMail.email));
      paydunyaDisburse({
        invoice: invoiceOk("tok-mailfail"),
        submit: { body: { response_code: "00" } },
        check: statusIs("success"),
      });
      emailsFail = true;
      try {
        await approveWithdrawal(admin.id, r3.id);
      } finally {
        emailsFail = false;
      }
      expect((await withdrawalRow(r3.id)).status).toBe("PAID");
    });

    it("withdrawal fees set by the admin are deducted: the net amount is paid out", async () => {
      const { requestWithdrawal } =
        await import("@/services/wallet/request-withdrawal");
      const { confirmWithdrawal } =
        await import("@/services/wallet/confirm-withdrawal");
      const { approveWithdrawal } =
        await import("@/services/admin/approve-withdrawal");
      const { updateParameter } =
        await import("@/services/admin/update-parameter");
      const admin = await makeUser("feeadmin", { role: "ADMIN" });

      // Out of bounds: refused.
      await expect(
        updateParameter(admin.id, "withdrawal.fee_percent_bp", 6000),
      ).rejects.toThrow("ne peuvent pas dépasser 50 %");

      // 1,5 % + 100 F.
      await updateParameter(admin.id, "withdrawal.fee_percent_bp", 150);
      await updateParameter(admin.id, "withdrawal.fee_fixed", 100);
      try {
        const member = await makeUser("feepayer", { balance: 20000 });
        // A withdrawal the fees would swallow is refused (fixed fee raised
        // above the amount for this one check).
        await updateParameter(admin.id, "withdrawal.fee_fixed", 90000);
        await expect(
          requestWithdrawal(
            member.id,
            5000,
            "+221770000009",
            "ORANGE_MONEY",
            "SN",
          ),
        ).rejects.toThrow("dépassent ce montant");
        await updateParameter(admin.id, "withdrawal.fee_fixed", 100);

        const request = await requestWithdrawal(
          member.id,
          10000,
          "+221770000009",
          "ORANGE_MONEY",
          "SN",
        );
        expect(request.feeAmount).toBe(250);
        const otpMail = sentEmails.filter((m) => m.to === member.email).at(-1)!;
        expect(otpMail.html).toMatch(/vous recevrez <strong>9.750 F<\/strong>/);

        await confirmWithdrawal(
          member.id,
          request.id,
          lastCodeSentTo(member.email),
        );
        // The balance is debited the full amount.
        expect((await balanceOf(member.id)).availableBalance).toBe(10000);

        paydunyaDisburse({
          invoice: invoiceOk("tok-fee"),
          submit: { body: { response_code: "00" } },
          check: statusIs("success"),
        });
        await approveWithdrawal(admin.id, request.id);

        // PayDunya is asked for the net amount only.
        const invoiceCall = fetchCalls
          .filter((c) => c.url.endsWith("/get-invoice"))
          .at(-1);
        expect(invoiceCall?.body).toMatchObject({ amount: 9750 });
        const row = await withdrawalRow(request.id);
        expect(row.status).toBe("PAID");
        const balance = await balanceRow(request.id);
        expect(balance?.withdrawnBalance).toBe(10000);
        const paidMail = sentEmails
          .filter(
            (m) => m.to === member.email && m.subject.includes("effectué"),
          )
          .at(-1)!;
        expect(paidMail.html).toMatch(
          /<strong>9.750 F<\/strong> ont été envoyés/,
        );
      } finally {
        // Back to no fee for the other tests.
        await updateParameter(admin.id, "withdrawal.fee_percent_bp", 0);
        await updateParameter(admin.id, "withdrawal.fee_fixed", 0);
      }
    });

    it("an operator PayDunya can't pay out to is refused when the withdrawal is requested", async () => {
      const { requestWithdrawal } =
        await import("@/services/wallet/request-withdrawal");
      const member = await makeUser("mobicash", { balance: 10000 });
      await expect(
        requestWithdrawal(member.id, 5000, "+22890000000", "MOBICASH", "TG"),
      ).rejects.toThrow("pas disponible pour les retraits");
    });
  });

  describe("H5 — PayDunya IPN", () => {
    async function postIpn(token: string, hash = PAYDUNYA_HASH) {
      const { POST } =
        await import("@/app/api/webhooks/providers/paydunya/route");
      return POST(
        new Request("http://localhost/api/webhooks/providers/paydunya", {
          method: "POST",
          body: JSON.stringify({
            data: { hash, status: "completed", invoice: { token } },
          }),
        }),
      );
    }

    function paydunyaConfirms(status: string, amount: string) {
      fetchHandler = (url) => {
        if (url.includes("/checkout-invoice/confirm/")) {
          return {
            status: 200,
            body: { status, invoice: { total_amount: amount } },
          };
        }
        throw new Error(`Appel inattendu : ${url}`);
      };
    }

    it("rejects a wrong hash without touching anything", async () => {
      const member = await makeUser("ipn0");
      const payment = await insertPendingPayment({
        userId: member.id,
        provider: "PAYDUNYA",
      });
      const response = await postIpn(payment.providerReference, "faux-hash");
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid webhook" });
      expect(await paymentStatus(payment.id)).toBe("PENDING");
    });

    it("a validly-hashed 'completed' IPN is ignored while PayDunya's API says pending", async () => {
      const member = await makeUser("ipn1");
      const payment = await insertPendingPayment({
        userId: member.id,
        provider: "PAYDUNYA",
      });
      paydunyaConfirms("pending", "15000");
      expect((await postIpn(payment.providerReference)).status).toBe(200);
      expect(await paymentStatus(payment.id)).toBe("PENDING");
    });

    it("a confirmed payment for the wrong amount is not applied", async () => {
      const member = await makeUser("ipn2");
      const payment = await insertPendingPayment({
        userId: member.id,
        provider: "PAYDUNYA",
      });
      paydunyaConfirms("completed", "1");
      await postIpn(payment.providerReference);
      expect(await paymentStatus(payment.id)).toBe("PENDING");
    });

    it("a real confirmation (amount as a string) activates the subscription, hash not stored", async () => {
      const member = await makeUser("ipn3");
      const payment = await insertPendingPayment({
        userId: member.id,
        provider: "PAYDUNYA",
      });
      paydunyaConfirms("completed", "15000");
      await postIpn(payment.providerReference);

      expect(await paymentStatus(payment.id)).toBe("CONFIRMED");
      const subscription = await localDb.query.subscriptions.findFirst({
        where: eq(schema.subscriptions.userId, member.id),
      });
      expect(subscription).toBeTruthy();
      const events = await localDb.query.paymentEvents.findMany({
        where: eq(schema.paymentEvents.paymentId, payment.id),
      });
      expect(events.length).toBeGreaterThan(0);
      for (const event of events) {
        expect(JSON.stringify(event.rawPayload)).not.toContain(PAYDUNYA_HASH);
      }
    });
  });

  describe("H1 — Wizall confirmation", () => {
    async function action() {
      return (await import("@/app/dashboard/subscription/actions"))
        .confirmWizallPaymentAction;
    }

    it("refuses a payment that isn't a PayDunya Wizall one, without calling PayDunya", async () => {
      const member = await makeUser("wizall0");
      currentUser = { profile: { id: member.id } };
      const payment = await insertPendingPayment({
        userId: member.id,
        provider: "BICTORYS",
      });
      const before = fetchCalls.length;

      const result = await (await action())(payment.id, "1234");
      expect(result.error).toBe("Paiement introuvable.");
      expect(fetchCalls.length).toBe(before);
      expect(await paymentStatus(payment.id)).toBe("PENDING");
    });

    it("refuses someone else's payment", async () => {
      const owner = await makeUser("wizall1");
      const intruder = await makeUser("wizall2");
      const payment = await insertPendingPayment({
        userId: owner.id,
        provider: "PAYDUNYA",
        metadata: { wizallTransactionId: "wz-1", wizallPhone: "771234567" },
      });
      currentUser = { profile: { id: intruder.id } };
      const result = await (await action())(payment.id, "1234");
      expect(result.error).toBe("Paiement introuvable.");
    });

    it("uses the server-side transaction id and only confirms once PayDunya does", async () => {
      const member = await makeUser("wizall3");
      currentUser = { profile: { id: member.id } };
      const payment = await insertPendingPayment({
        userId: member.id,
        provider: "PAYDUNYA",
        metadata: {
          wizallTransactionId: "wz-server-side",
          wizallPhone: "771234567",
        },
      });
      let invoiceStatus = "pending";
      fetchHandler = (url) => {
        if (url.includes("/softpay/wizall-money-senegal/confirm")) {
          return { status: 200, body: { success: true, message: "ok" } };
        }
        if (url.includes("/checkout-invoice/confirm/")) {
          return {
            status: 200,
            body: { status: invoiceStatus, invoice: { total_amount: 15000 } },
          };
        }
        throw new Error(`Appel inattendu : ${url}`);
      };

      const first = await (await action())(payment.id, "1234");
      expect(first.error).toContain("pas encore confirmé");
      expect(await paymentStatus(payment.id)).toBe("PENDING");
      const wizallCall = [...fetchCalls]
        .reverse()
        .find((c) => c.url.includes("/softpay/wizall-money-senegal/confirm"));
      expect(wizallCall?.body).toMatchObject({
        transaction_id: "wz-server-side",
      });

      invoiceStatus = "completed";
      const second = await (await action())(payment.id, "1234");
      expect(second.error).toBeNull();
      expect(await paymentStatus(payment.id)).toBe("CONFIRMED");
    });
  });

  it("M7 — the payment poll never applies a confirmation for the wrong amount", async () => {
    const { checkSubscriptionConfirmedAction } =
      await import("@/app/dashboard/subscription/actions");
    const member = await makeUser("poll");
    currentUser = { profile: { id: member.id } };
    const payment = await insertPendingPayment({
      userId: member.id,
      provider: "PAYDUNYA",
    });
    fetchHandler = () => ({
      status: 200,
      body: { status: "completed", invoice: { total_amount: 14000 } },
    });

    expect(await checkSubscriptionConfirmedAction(payment.id)).toBe("PENDING");
    expect(await paymentStatus(payment.id)).toBe("PENDING");
  });

  it("M3 — HTML in signup metadata never becomes a username", async () => {
    const { ensureProfile } = await import("@/services/auth/ensure-profile");
    const id = randomUUID();
    await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
      id,
    ]);

    const profile = await ensureProfile({
      id,
      user_metadata: {
        username: '<a href="https://phish">x</a>',
        full_name: "Test",
      },
    } as never);
    expect(profile?.username).toBe(`membre_${id.slice(0, 8)}`);
  });

  it("M4 — member-controlled names are escaped in emails", async () => {
    const { initiateAdminRecharge } =
      await import("@/services/admin/initiate-recharge");
    const admin = await makeUser("rechargeadmin", { role: "ADMIN" });
    const beneficiary = await makeUser("victim", {
      fullName: '<a href="https://phish.example">Sécurisez votre compte</a>',
    });

    await initiateAdminRecharge(admin.id, beneficiary.username, 1000);
    const mail = [...sentEmails].reverse().find((m) => m.to === admin.email);
    expect(mail?.html).toContain(
      "&lt;a href=&quot;https://phish.example&quot;&gt;",
    );
    expect(mail?.html).not.toContain('<a href="https://phish.example">');
  });

  it("sign-in without the confirmation link still records the sponsor", async () => {
    const { ensureProfile } = await import("@/services/auth/ensure-profile");
    const sponsor = await makeUser("sponsorlogin");
    const id = randomUUID();
    await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
      id,
    ]);

    // What getCurrentUser does on a plain password sign-in, with no
    // /auth/callback involved at all.
    await ensureProfile({
      id,
      user_metadata: {
        username: `filleul_${id.slice(0, 6)}`,
        full_name: "Filleule",
        sponsor_id: sponsor.id,
        wants_ambassador: true,
      },
    } as never);
    const sponsorship = await localDb.query.sponsorships.findFirst({
      where: eq(schema.sponsorships.userId, id),
    });
    expect(sponsorship?.sponsorId).toBe(sponsor.id);
  });

  it("a paid subscription is never rolled back by an ambassador opt-in that can't be honored", async () => {
    const { checkSubscriptionConfirmedAction } =
      await import("@/app/dashboard/subscription/actions");
    // A tree root already exists (earlier tests may have created one; make
    // sure of it), and this member wants to be an ambassador but has no
    // sponsorship on file — the exact production case.
    const existingRoot = await localDb.query.binaryNodes.findFirst({
      where: sql`${schema.binaryNodes.binaryParentId} IS NULL`,
    });
    if (!existingRoot) {
      const { createRootNode } =
        await import("@/services/genealogy/place-member");
      const rootUser = await makeUser("root");
      await createRootNode(localDb, rootUser.id);
    }
    const member = await makeUser("nosponsor");
    await localDb
      .update(schema.profiles)
      .set({ status: "PENDING_PAYMENT", wantsAmbassador: true })
      .where(eq(schema.profiles.id, member.id));
    currentUser = { profile: { id: member.id } };
    const payment = await insertPendingPayment({
      userId: member.id,
      provider: "PAYDUNYA",
      amount: 300,
    });
    fetchHandler = () => ({
      status: 200,
      body: { status: "completed", invoice: { total_amount: 300 } },
    });

    expect(await checkSubscriptionConfirmedAction(payment.id)).toBe(
      "CONFIRMED",
    );
    const profile = await localDb.query.profiles.findFirst({
      where: eq(schema.profiles.id, member.id),
    });
    expect(profile.status).toBe("ACTIVE");
    const subscription = await localDb.query.subscriptions.findFirst({
      where: eq(schema.subscriptions.userId, member.id),
    });
    expect(subscription).toBeTruthy();
    const ambassador = await localDb.query.ambassadorProfiles.findFirst({
      where: eq(schema.ambassadorProfiles.userId, member.id),
    });
    expect(ambassador).toBeUndefined();
  });

  it("sanity — nothing in this suite reached a real network host", async () => {
    // Every provider URL above was answered by the stub; this just guards
    // against a future edit accidentally leaving a real call un-stubbed.
    const rows = await localDb.execute(sql`SELECT 1 AS ok`);
    expect(rows[0].ok).toBe(1);
    expect(fetchCalls.every((c) => /paydunya|bictorys/.test(c.url))).toBe(true);
  });
});
