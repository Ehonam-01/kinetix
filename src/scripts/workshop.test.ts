// The workshop end to end, against a disposable pglite database with every
// real migration applied and a fake provider: registration -> payment ->
// confirmation -> seats -> discount code -> subscription. Nothing shared is
// touched and no real charge is made.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { toCsv } from "@/lib/csv";
import { buildWorkshopIcs } from "@/lib/workshop-ics";
import { toWorkshopPhone } from "@/schemas/workshop";
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
const sentEmails: { to: string; html: string }[] = [];
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; html: string }) => {
      sentEmails.push(input);
    },
  },
}));
const alerts: string[] = [];
vi.mock("@/services/notifications/admin-alerts", () => ({
  alertAdmins: (_key: string, subject: string) => alerts.push(subject),
  alertAmountMismatch: () => alerts.push("montant"),
}));

let providerFails = false;
const charges: { amount: number; address?: string; email: string }[] = [];
let verifiedStatus: "PENDING" | "CONFIRMED" | "FAILED" = "PENDING";
let lastReference = "";
const provider = {
  name: "PAYDUNYA",
  createPayment: async (input: {
    amount: number;
    address?: string;
    customer: { email: string };
  }) => {
    if (providerFails) throw new Error("Fournisseur indisponible");
    charges.push({
      amount: input.amount,
      address: input.address,
      email: input.customer.email,
    });
    lastReference = `ref-${randomUUID()}`;
    return {
      providerReference: lastReference,
      checkoutUrl: null,
      confirmationMessage: "Vérifiez votre téléphone.",
    };
  },
  verifyPayment: async (providerReference: string) => ({
    providerReference,
    status: verifiedStatus,
    amount: 2000,
  }),
};
vi.mock("@/services/payments/provider-selector", () => ({
  getActivePaymentProvider: async () => provider,
  getPaymentProviderByName: () => provider,
}));
process.env.SITE_URL ??= "https://kinetix.example";

const ORIGIN = "https://kinetix.example";

function participant(whatsapp: string, email: string | null = null) {
  return {
    fullName: "Ama Mensah",
    whatsapp,
    email,
    city: "Lomé",
    operator: "TOGOCELL",
    paymentPhone: whatsapp,
    origin: ORIGIN,
  };
}

async function register(whatsapp: string, email: string | null = null) {
  const { registerForWorkshop } = await import("@/services/workshops/register");
  return registerForWorkshop(participant(whatsapp, email));
}

async function registrationOf(whatsapp: string) {
  return localDb.query.workshopRegistrations.findFirst({
    where: eq(schema.workshopRegistrations.whatsapp, whatsapp),
  });
}

// What the provider's webhook reaches, with a dedupe key of its own.
async function webhook(status: "CONFIRMED" | "FAILED", reference: string) {
  const { processWebhookEvent } =
    await import("@/services/payments/process-webhook-event");
  return localDb.transaction((tx: never) =>
    processWebhookEvent(tx, {
      providerReference: reference,
      status,
      eventType: "test",
      dedupeKey: `test:${reference}:${status}:${randomUUID()}`,
      raw: {},
      amount: 2000,
    }),
  );
}

async function paidParticipant(whatsapp: string) {
  await register(whatsapp);
  await webhook("CONFIRMED", lastReference);
  return registrationOf(whatsapp);
}

async function setWorkshop(values: Record<string, unknown>) {
  await localDb.update(schema.workshops).set(values);
}

async function makeMember() {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `m_${id.slice(0, 8)}`,
    fullName: "Membre Test",
    status: "PENDING_PAYMENT",
  });
  return id;
}

async function subscribeWithCode(member: string, code: string) {
  const { initiateSubscriptionPayment } =
    await import("@/services/subscriptions/initiate-subscription-payment");
  return initiateSubscriptionPayment({
    buyerUserId: member,
    email: "m@example.test",
    fullName: "Membre Test",
    returnUrl: `${ORIGIN}/dashboard/subscription`,
    country: "TG",
    operator: "TOGOCELL",
    phone: "22890000000",
    workshopCode: code,
  });
}

describe("workshop (pglite, no shared DB touched, fake provider)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    await seedDefaultCommissionRules(db);
  }, 120_000);

  beforeEach(async () => {
    await localDb.update(schema.workshopRegistrations).set({
      discountPaymentId: null,
    });
    await localDb.delete(schema.workshopRegistrations);
    await setWorkshop({
      capacity: 50,
      registrationsOpen: true,
      startsAt: new Date(Date.now() + 86_400_000),
      discountValidUntil: new Date(Date.now() + 2 * 86_400_000),
    });
    charges.length = 0;
    alerts.length = 0;
    sentEmails.length = 0;
    providerFails = false;
    verifiedStatus = "PENDING";
  });

  it("comes seeded with the agreed settings", async () => {
    const workshop = await localDb.query.workshops.findFirst();
    expect(workshop).toMatchObject({
      slug: "atelier-video-ia",
      priceCfa: 2000,
      regularPriceCfa: 25000,
    });
    expect(workshop.endsAt.toISOString()).toBe("2026-11-14T13:00:00.000Z");
  });

  it("a started payment confirms nothing, and takes no seat", async () => {
    const { getWorkshop, getWorkshopAvailability } =
      await import("@/repositories/workshops");
    const result = await register("22890000001");

    expect(result.outcome).toBe("STARTED");
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({ amount: 2000, address: "Lomé" });
    // No email given: a mailbox of ours, as PayDunya requires one.
    expect(charges[0].email).toMatch(/^atelier@/);
    const registration = await registrationOf("22890000001");
    expect(registration).toMatchObject({
      status: "PENDING",
      discountCode: null,
    });
    const workshop = await getWorkshop(localDb);
    expect((await getWorkshopAvailability(localDb, workshop)).remaining).toBe(
      50,
    );
  });

  it("the webhook confirms the seat, once, with a code and an email", async () => {
    const { getWorkshop, getWorkshopAvailability } =
      await import("@/repositories/workshops");
    await register("22890000002", "ama@example.test");
    const reference = lastReference;

    await webhook("CONFIRMED", reference);
    await webhook("CONFIRMED", reference);

    const registration = await registrationOf("22890000002");
    expect(registration.status).toBe("PAID");
    expect(registration.discountCode).toMatch(/^ATELIER-[A-Z2-9]{8}$/);
    const workshop = await getWorkshop(localDb);
    expect((await getWorkshopAvailability(localDb, workshop)).remaining).toBe(
      49,
    );
    await vi.waitFor(() => expect(sentEmails).toHaveLength(1));
    // The code is handed out after the workshop, not at registration.
    expect(sentEmails[0].html).not.toContain(registration.discountCode);
  });

  it("a failed payment frees the number, a double submission doesn't", async () => {
    await register("22890000003");
    const reference = lastReference;
    expect((await register("22890000003")).outcome).toBe("IN_PROGRESS");
    expect(charges).toHaveLength(1);

    await webhook("FAILED", reference);
    expect((await registrationOf("22890000003")).status).toBe("FAILED");
    expect((await register("22890000003")).outcome).toBe("STARTED");
  });

  it("a number already paid can't register again", async () => {
    await paidParticipant("22890000004");
    expect((await register("22890000004")).outcome).toBe("ALREADY_PAID");
  });

  it("a provider failure leaves the number free to retry", async () => {
    providerFails = true;
    await expect(register("22890000005")).rejects.toThrow("indisponible");
    expect((await registrationOf("22890000005")).status).toBe("FAILED");
    providerFails = false;
    expect((await register("22890000005")).outcome).toBe("STARTED");
  });

  it("the confirmation page's check confirms what the provider reports", async () => {
    const { checkWorkshopRegistration } =
      await import("@/services/workshops/check-status");
    await register("22890000006");
    const { accessToken } = await registrationOf("22890000006");

    expect(await checkWorkshopRegistration(accessToken)).toBe("PENDING");
    verifiedStatus = "CONFIRMED";
    expect(await checkWorkshopRegistration(accessToken)).toBe("PAID");
    expect((await registrationOf("22890000006")).status).toBe("PAID");
    expect(await checkWorkshopRegistration("inconnu")).toBeNull();
  });

  it("at capacity no payment starts: the visitor goes to WhatsApp", async () => {
    const { getWorkshop, getWorkshopAvailability } =
      await import("@/repositories/workshops");
    await paidParticipant("22890000007");
    await setWorkshop({ capacity: 1 });

    expect((await register("22890000008")).outcome).toBe("FULL");
    expect(charges).toHaveLength(1);
    const workshop = await getWorkshop(localDb);
    expect(await getWorkshopAvailability(localDb, workshop)).toMatchObject({
      remaining: 0,
      open: false,
    });
  });

  it("a payment confirmed past the capacity keeps its seat, admins told", async () => {
    await register("22890000009");
    const first = lastReference;
    await register("22890000010");
    const second = lastReference;
    await setWorkshop({ capacity: 1 });

    await webhook("CONFIRMED", first);
    await webhook("CONFIRMED", second);

    expect((await registrationOf("22890000010")).status).toBe("PAID");
    expect(alerts).toContain("Atelier : capacité dépassée");
  });

  it("closing registrations stops the online sale", async () => {
    await setWorkshop({ registrationsOpen: false });
    expect((await register("22890000011")).outcome).toBe("FULL");
  });

  it("the code takes the workshop off a subscription, once", async () => {
    const { confirmSubscriptionPurchaseInNewTransaction } =
      await import("@/services/subscriptions/confirm-subscription-payment");
    const { getCurrentParameterValue } =
      await import("@/repositories/parameter-versions");
    const price = await getCurrentParameterValue(
      localDb,
      "subscription.price_in_cfa",
    );
    const { discountCode } = await paidParticipant("22890000012");
    const member = await makeMember();

    const { payment } = await subscribeWithCode(
      member,
      discountCode.toLowerCase(),
    );
    expect(payment.amount).toBe(price - 2000);

    // Held while that payment waits, for anyone else.
    await expect(
      subscribeWithCode(await makeMember(), discountCode),
    ).rejects.toThrow("déjà utilisé");

    await confirmSubscriptionPurchaseInNewTransaction(payment.id);
    const registration = await registrationOf("22890000012");
    expect(registration.discountUsedAt).not.toBeNull();
    expect(registration.discountPaymentId).toBe(payment.id);

    // Spent for good, even once the reservation has lapsed.
    await localDb
      .update(schema.workshopRegistrations)
      .set({ discountReservedUntil: null })
      .where(eq(schema.workshopRegistrations.id, registration.id));
    await expect(
      subscribeWithCode(await makeMember(), discountCode),
    ).rejects.toThrow("déjà utilisé");
  });

  it("a code refused by the provider, past its date or unknown is not spent", async () => {
    const { findWorkshopDiscount } =
      await import("@/services/workshops/discount");
    const { discountCode } = await paidParticipant("22890000013");
    const member = await makeMember();

    providerFails = true;
    await expect(subscribeWithCode(member, discountCode)).rejects.toThrow(
      "indisponible",
    );
    providerFails = false;
    expect(await findWorkshopDiscount(localDb, discountCode)).toBe(2000);

    await setWorkshop({ discountValidUntil: new Date(Date.now() - 1000) });
    expect(await findWorkshopDiscount(localDb, discountCode)).toBeNull();
    await expect(subscribeWithCode(member, discountCode)).rejects.toThrow(
      "expiré",
    );
    await expect(subscribeWithCode(member, "ATELIER-XXXX")).rejects.toThrow(
      "invalide",
    );
  });

  it("the sponsor's commission follows the reduced price", async () => {
    const { confirmSubscriptionPurchaseInNewTransaction } =
      await import("@/services/subscriptions/confirm-subscription-payment");
    const { discountCode } = await paidParticipant("22890000014");
    const member = await makeMember();
    const { payment } = await subscribeWithCode(member, discountCode);

    const subscription = await confirmSubscriptionPurchaseInNewTransaction(
      payment.id,
    );
    expect(subscription?.pricePaid).toBe(payment.amount);
  });

  it("an admin adds someone paid off-site, past the capacity if needed", async () => {
    const { addWorkshopRegistration, updateWorkshopSettings } =
      await import("@/services/workshops/admin");
    const admin = await makeMember();
    await localDb
      .update(schema.profiles)
      .set({ role: "ADMIN" })
      .where(eq(schema.profiles.id, admin));
    await setWorkshop({ capacity: 0 });

    await addWorkshopRegistration(admin, {
      fullName: "Kofi Agbeko",
      whatsapp: "90 00 00 15",
      email: "",
      city: "Kpalimé",
      amount: 1500,
    });
    expect(await registrationOf("22890000015")).toMatchObject({
      status: "PAID",
      source: "ADMIN",
      amount: 1500,
      paymentId: null,
    });

    await updateWorkshopSettings(admin, {
      priceCfa: 2500,
      regularPriceCfa: 25000,
      capacity: 60,
      venue: "Lomé, Tokoin",
      whatsappGroupUrl: "https://chat.whatsapp.com/AbC123",
      exampleVideoUrls: ["", "https://youtube.com/shorts/dQw4w9WgXcQ", ""],
      registrationsOpen: false,
    });
    expect(await localDb.query.workshops.findFirst()).toMatchObject({
      priceCfa: 2500,
      capacity: 60,
      exampleVideoUrls: ["https://youtube.com/shorts/dQw4w9WgXcQ"],
      registrationsOpen: false,
    });
    await expect(
      updateWorkshopSettings(admin, {
        priceCfa: 2000,
        regularPriceCfa: 25000,
        capacity: 50,
        venue: "Lomé",
        whatsappGroupUrl: "",
        exampleVideoUrls: ["https://exemple.com/video"],
        registrationsOpen: true,
      }),
    ).rejects.toThrow("Lien YouTube invalide");
    await updateWorkshopSettings(admin, {
      priceCfa: 2000,
      regularPriceCfa: 25000,
      capacity: 50,
      venue: "[adresse précise, Lomé]",
      whatsappGroupUrl: "",
      exampleVideoUrls: [],
      registrationsOpen: true,
    });

    const member = await makeMember();
    await expect(
      addWorkshopRegistration(member, {
        fullName: "Non Admin",
        whatsapp: "90000016",
        email: "",
        city: "Lomé",
        amount: 0,
      }),
    ).rejects.toThrow("Seul un administrateur");
  });

  it("normalizes a phone typed the usual ways", () => {
    expect(toWorkshopPhone("90 00 00 00")).toBe("22890000000");
    expect(toWorkshopPhone("+228 90 00 00 00")).toBe("22890000000");
    expect(toWorkshopPhone("+229 01 97 00 00 00")).toBe("2290197000000");
    expect(toWorkshopPhone("abc")).toBeNull();
  });

  it("builds a valid calendar file", () => {
    const ics = buildWorkshopIcs({
      id: "abc",
      title: "Atelier, vidéo; IA",
      startsAt: new Date("2026-11-14T08:00:00Z"),
      endsAt: new Date("2026-11-14T13:00:00Z"),
      venue: "Lomé",
      url: ORIGIN,
    });
    expect(ics).toContain("DTSTART:20261114T080000Z\r\n");
    expect(ics).toContain("DTEND:20261114T130000Z\r\n");
    expect(ics).toContain("SUMMARY:Atelier\\, vidéo\\; IA\r\n");
  });

  it("keeps a typed formula harmless in the CSV", () => {
    const csv = toCsv([["=HYPERLINK(1)", 'A "B"', null]]);
    expect(csv).toContain(`"'=HYPERLINK(1)";"A ""B""";""`);
  });
});
