// Buying one course on its own (services/lms/course-purchase.ts), end to
// end against a disposable pglite database with every real migration
// applied and a fake provider: who may buy, the confirmed payment opening
// the course for life, the buyer becoming a learner, a redelivered webhook
// counted once. Nothing shared is touched, no real charge is made.
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
const charges: { amount: number; description: string }[] = [];
vi.mock("@/services/payments/provider-selector", () => ({
  getActivePaymentProvider: async () => ({
    name: "PAYDUNYA",
    createPayment: async (input: { amount: number; description: string }) => {
      charges.push(input);
      return {
        providerReference: `ref-${randomUUID()}`,
        checkoutUrl: null,
        confirmationMessage: "Vérifiez votre téléphone.",
      };
    },
  }),
}));
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: { sendEmail: async () => undefined },
}));
process.env.SITE_URL ??= "https://kinetix.example";

const DAY_MS = 24 * 60 * 60 * 1000;

async function makeProfile(
  label: string,
  values: Partial<typeof schema.profiles.$inferInsert> = {},
) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `Profil ${label}`,
    ...values,
  });
  return id;
}

async function subscribe(userId: string, expiresInDays: number) {
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: userId,
      purpose: "SUBSCRIPTION",
      method: "ADMIN_CREDIT",
      amount: 35_000,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
    pricePaid: 35_000,
    businessVolume: 15,
  });
}

async function makeCourse(salePrice: number | null) {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title: "Montage vidéo", status: "PUBLISHED", salePrice })
    .returning();
  return course.id as string;
}

const base = (buyerUserId: string, courseId: string) => ({
  buyerUserId,
  courseId,
  email: "acheteur@example.test",
  fullName: "Ama Mensah",
  returnUrl: "https://kinetix.example/formations/x/acheter",
  country: "TG",
  operator: "TMONEY",
  phone: "90000000",
});

// Starts the purchase, then confirms it the way a real webhook does.
async function buyAndConfirm(buyerUserId: string, courseId: string) {
  const { initiateCoursePurchase } =
    await import("@/services/lms/course-purchase");
  const { processWebhookEvent } =
    await import("@/services/payments/process-webhook-event");
  const intent = await initiateCoursePurchase(base(buyerUserId, courseId));
  const event = {
    providerReference: intent.payment.providerReference!,
    status: "CONFIRMED" as const,
    eventType: "test",
    dedupeKey: `test:${intent.payment.id}`,
    raw: {},
  };
  await localDb.transaction((tx: never) => processWebhookEvent(tx, event));
  return { intent, event };
}

// An active ambassador with a valid subscription, and a learner they
// sponsor.
async function makeSponsoredLearner(sponsorSubscribedDays = 200) {
  const sponsor = await makeProfile("parrain", { status: "ACTIVE" });
  await subscribe(sponsor, sponsorSubscribedDays);
  await localDb.insert(schema.ambassadorProfiles).values({
    userId: sponsor,
    referralCode: `p_${sponsor.slice(0, 8)}`,
    termsAcceptedAt: new Date(),
    termsVersion: "test",
  });
  const learner = await makeProfile("filleul", { accountType: "LEARNER" });
  await localDb
    .insert(schema.sponsorships)
    .values({ userId: learner, sponsorId: sponsor });
  return { sponsor, learner };
}

async function commissionsOf(userId: string) {
  const rows = await localDb.query.commissionEvents.findMany({
    where: eq(schema.commissionEvents.beneficiaryUserId, userId),
  });
  return rows.map((r: { amount: number; type: string }) => [r.type, r.amount]);
}

const salesOf = (userId: string) =>
  localDb.query.sales.findMany({
    where: eq(schema.sales.buyerUserId, userId),
  });
const profileOf = (userId: string) =>
  localDb.query.profiles.findFirst({ where: eq(schema.profiles.id, userId) });

describe("course bought on its own (pglite, fake provider)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("a learner pays the course's price and keeps it for life", async () => {
    const { hasCourseAccess } = await import("@/repositories/courses");
    const { processWebhookEvent } =
      await import("@/services/payments/process-webhook-event");
    const learner = await makeProfile("apprenant", { accountType: "LEARNER" });
    const courseId = await makeCourse(15_000);
    expect(await hasCourseAccess(localDb, learner, courseId)).toBe(false);

    const { intent, event } = await buyAndConfirm(learner, courseId);
    expect(intent.payment).toMatchObject({
      purpose: "COURSE_PURCHASE",
      amount: 15_000,
      status: "PENDING",
    });
    expect(charges.at(-1)).toMatchObject({
      amount: 15_000,
      description: "Formation : Montage vidéo",
    });
    expect(await hasCourseAccess(localDb, learner, courseId)).toBe(true);
    const [sale] = await salesOf(learner);
    expect(sale).toMatchObject({
      courseId,
      pricePaid: 15_000,
      businessVolume: 0,
      status: "CONFIRMED",
    });

    // The same webhook delivered again: one sale.
    await localDb.transaction((tx: never) =>
      processWebhookEvent(tx, { ...event, dedupeKey: `${event.dedupeKey}:2` }),
    );
    expect(await salesOf(learner)).toHaveLength(1);

    // Bought once: not again.
    const { initiateCoursePurchase } =
      await import("@/services/lms/course-purchase");
    await expect(
      initiateCoursePurchase(base(learner, courseId)),
    ).rejects.toThrow("déjà accès");
  });

  it("a member account that never paid becomes a learner", async () => {
    const member = await makeProfile("jamais_paye");
    expect((await profileOf(member)).accountType).toBe("MEMBER");
    await buyAndConfirm(member, await makeCourse(10_000));
    expect(await profileOf(member)).toMatchObject({
      accountType: "LEARNER",
      status: "PENDING_PAYMENT",
    });
  });

  it("refuses a course not sold alone, a subscriber, a former member", async () => {
    const { initiateCoursePurchase } =
      await import("@/services/lms/course-purchase");
    const before = charges.length;

    const learner = await makeProfile("eleve", { accountType: "LEARNER" });
    await expect(
      initiateCoursePurchase(base(learner, await makeCourse(null))),
    ).rejects.toThrow("qu'avec l'abonnement");

    const courseId = await makeCourse(12_000);
    const subscriber = await makeProfile("abonne", { status: "ACTIVE" });
    await subscribe(subscriber, 200);
    await expect(
      initiateCoursePurchase(base(subscriber, courseId)),
    ).rejects.toThrow("déjà accès");

    const former = await makeProfile("ancien", { status: "ACTIVE" });
    await subscribe(former, -400);
    await expect(
      initiateCoursePurchase(base(former, courseId)),
    ).rejects.toThrow("renouvelle ton abonnement");

    const suspended = await makeProfile("suspendu", {
      accountType: "LEARNER",
      status: "SUSPENDED",
    });
    await expect(
      initiateCoursePurchase(base(suspended, courseId)),
    ).rejects.toThrow("suspendu");

    const [draft] = await localDb
      .insert(schema.courses)
      .values({ title: "Brouillon", status: "DRAFT", salePrice: 5_000 })
      .returning();
    await expect(
      initiateCoursePurchase(base(learner, draft.id)),
    ).rejects.toThrow("pas encore ouverte");

    expect(charges.length).toBe(before);
  });

  it("the sponsor earns 15 % of the course, once, reversed by a refund", async () => {
    const { processWebhookEvent } =
      await import("@/services/payments/process-webhook-event");
    const { refundSale } = await import("@/services/sales/refund-sale");
    const { getBalance } =
      await import("@/repositories/financial-transactions");
    const { sponsor, learner } = await makeSponsoredLearner();
    const courseId = await makeCourse(15_000);

    const { event } = await buyAndConfirm(learner, courseId);
    const [sale] = await salesOf(learner);
    expect(sale.ambassadorUserId).toBe(sponsor);
    expect(await commissionsOf(sponsor)).toEqual([["DIRECT_SALE", 2_250]]);
    expect((await getBalance(localDb, sponsor)).availableBalance).toBe(2_250);
    // Counts for nobody's progression.
    expect(sale.businessVolume).toBe(0);

    await localDb.transaction((tx: never) =>
      processWebhookEvent(tx, { ...event, dedupeKey: `${event.dedupeKey}:2` }),
    );
    expect(await commissionsOf(sponsor)).toHaveLength(1);

    const admin = await makeProfile("admin", { role: "ADMIN" });
    await refundSale(admin, sale.id, { revokeAccess: true });
    expect((await getBalance(localDb, sponsor)).availableBalance).toBe(0);
  });

  it("the rate comes from the course-sale rule, not the subscription's", async () => {
    const { sponsor, learner } = await makeSponsoredLearner();
    const courseId = await makeCourse(10_000);
    // A rule for this very course wins over the 15 % of every course.
    await localDb.insert(schema.commissionRules).values({
      scope: "DIRECT_SALE",
      courseId,
      commissionType: "PERCENTAGE",
      rate: 2_000,
    });
    await buyAndConfirm(learner, courseId);
    expect(await commissionsOf(sponsor)).toEqual([["DIRECT_SALE", 2_000]]);

    const seeded = await localDb.query.commissionRules.findMany({
      where: eq(schema.commissionRules.category, "VENTE_COURS"),
    });
    expect(seeded).toMatchObject([
      { scope: "DIRECT_SALE", commissionType: "PERCENTAGE", rate: 1_500 },
    ]);
  });

  it("no commission for a lapsed sponsor or without a sponsor", async () => {
    const { sponsor, learner } = await makeSponsoredLearner(-400);
    await buyAndConfirm(learner, await makeCourse(9_000));
    expect(await commissionsOf(sponsor)).toEqual([]);
    // The sale still names them; their subscription lapsed, so nothing is
    // paid (the usual rule for every commission).
    expect((await salesOf(learner))[0].ambassadorUserId).toBe(sponsor);

    const alone = await makeProfile("seul", { accountType: "LEARNER" });
    await buyAndConfirm(alone, await makeCourse(9_000));
    expect((await salesOf(alone))[0].ambassadorUserId).toBe(null);
  });

  it("a learner who subscribes becomes a member and keeps the course", async () => {
    const { confirmSubscriptionPurchaseInNewTransaction } =
      await import("@/services/subscriptions/confirm-subscription-payment");
    const { hasCourseAccess } = await import("@/repositories/courses");
    const learner = await makeProfile("devient_membre", {
      accountType: "LEARNER",
    });
    const courseId = await makeCourse(15_000);
    await buyAndConfirm(learner, courseId);

    // The full price, nothing taken off (explicit user decision).
    const [payment] = await localDb
      .insert(schema.payments)
      .values({
        beneficiaryUserId: learner,
        purpose: "SUBSCRIPTION",
        method: "MOBILE_MONEY",
        amount: 35_000,
        status: "PENDING",
        idempotencyKey: `TEST:${randomUUID()}`,
      })
      .returning();
    await confirmSubscriptionPurchaseInNewTransaction(payment.id);
    expect(await profileOf(learner)).toMatchObject({
      accountType: "MEMBER",
      status: "ACTIVE",
    });
    expect(await hasCourseAccess(localDb, learner, courseId)).toBe(true);
    expect(await salesOf(learner)).toHaveLength(1);
  });

  it("the sponsor and the admin see the course sold, with its commission", async () => {
    const { listCourseSalesForAmbassador, listSalesForAdmin } =
      await import("@/repositories/sales");
    const { sponsor, learner } = await makeSponsoredLearner();
    await buyAndConfirm(learner, await makeCourse(20_000));

    expect(await listCourseSalesForAmbassador(localDb, sponsor)).toMatchObject([
      { courseTitle: "Montage vidéo", pricePaid: 20_000, commission: 3_000 },
    ]);
    const [sale] = await salesOf(learner);
    const listed = (await listSalesForAdmin(localDb)).find(
      (s: { id: string }) => s.id === sale.id,
    );
    expect(listed).toMatchObject({
      buyerFullName: "Profil filleul",
      commission: 3_000,
    });
  });

  it("a payment that fails opens nothing", async () => {
    const { initiateCoursePurchase } =
      await import("@/services/lms/course-purchase");
    const { processWebhookEvent } =
      await import("@/services/payments/process-webhook-event");
    const { hasCourseAccess } = await import("@/repositories/courses");
    const learner = await makeProfile("echec", { accountType: "LEARNER" });
    const courseId = await makeCourse(8_000);
    const intent = await initiateCoursePurchase(base(learner, courseId));
    await localDb.transaction((tx: never) =>
      processWebhookEvent(tx, {
        providerReference: intent.payment.providerReference!,
        status: "FAILED",
        eventType: "test",
        dedupeKey: `test:${intent.payment.id}:failed`,
        raw: {},
      }),
    );
    expect(await hasCourseAccess(localDb, learner, courseId)).toBe(false);
    expect(await salesOf(learner)).toEqual([]);
  });
});
