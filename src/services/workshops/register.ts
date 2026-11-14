import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { workshopRegistrations } from "@/db/schema/workshops";
import {
  findBlockingRegistration,
  getSession,
  getWorkshop,
  getWorkshopAvailability,
  listSessions,
} from "@/repositories/workshops";
import { getActivePaymentProvider } from "@/services/payments/provider-selector";

// How long a payment just started blocks a new one for the same number: the
// prompt is still on the phone, and a double tap must not send a second one.
const PENDING_WINDOW_MS = 5 * 60 * 1000;

// Moov Togo requires an address and this form doesn't ask for one: the
// session's city, or this when there's none.
export const PAYMENT_ADDRESS = "Lomé";

// The sessions a number can hold a seat in: those sold on the page now
// (the first edition's seats, on the page's own row, no longer count).
export async function currentSessionIds() {
  const page = await getWorkshop(db);
  return (await listSessions(db, page.id)).map((session) => session.id);
}

// What the form shows for a number that already holds a seat.
export type HeldSeat = {
  left: number;
  firstName: string;
  city: string;
  startsAt: string;
};

export function splitName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}

// PayDunya requires an email and this form doesn't: a mailbox of ours, never
// shown to the participant and never written to.
export function paymentEmail(email: string | null) {
  return email ?? `atelier@${new URL(getSiteEnv().SITE_URL).hostname}`;
}

type RegisterInput = {
  // The city chosen on the form: one of the page's sessions.
  sessionId: string;
  fullName: string;
  whatsapp: string;
  email: string | null;
  operator: string;
  paymentPhone: string;
  amount: number;
  origin: string;
};

type RegisterResult =
  | { outcome: "FULL" }
  | { outcome: "ALREADY_PAID" }
  // This number already holds a seat with something left to pay: shown,
  // so the form offers to pay it (pay-more.ts payWorkshopBalanceByNumber).
  | ({ outcome: "BALANCE_DUE" } & HeldSeat)
  | { outcome: "IN_PROGRESS" }
  | { outcome: "NO_SESSION" }
  | { outcome: "TOO_MUCH"; price: number }
  | {
      outcome: "STARTED";
      token: string;
      checkoutUrl: string | null;
    };

// Starts a seat's payment, which confirms nothing by itself: the seat only
// exists once processWebhookEvent reaches confirmWorkshopRegistration. The
// seat count is read here and not locked, on purpose (explicit user
// decision, see db/schema/workshops.ts): two people paying for the last
// seat both keep theirs. Past the capacity the visitor goes to WhatsApp.
//
// Rows are written before calling the provider, as in
// initiate-subscription-payment.ts: a charge that goes through while the
// call fails on our side still leaves something to reconcile.
export async function registerForWorkshop(
  input: RegisterInput,
): Promise<RegisterResult> {
  const page = await getWorkshop(db);
  const sessions = await listSessions(db, page.id);
  const existing = await findBlockingRegistration(
    db,
    sessions.map((session) => session.id),
    input.whatsapp,
    new Date(Date.now() - PENDING_WINDOW_MS),
  );
  // Checked before the seat count: a seat already held stays payable even
  // once the online sale has stopped.
  if (existing?.status === "PAID" && existing.amountPaid < existing.amount) {
    const held = sessions.find((s) => s.id === existing.workshopId)!;
    return {
      outcome: "BALANCE_DUE",
      left: existing.amount - existing.amountPaid,
      firstName: splitName(existing.fullName).firstName,
      city: held.city ?? "",
      startsAt: held.startsAt.toISOString(),
    };
  }
  const workshop = await getSession(db, page.id, input.sessionId);
  if (!workshop) return { outcome: "NO_SESSION" };
  const { open } = await getWorkshopAvailability(db, workshop);
  if (!open) return { outcome: "FULL" };
  // The whole price, or a first part of it (schemas/workshop.ts checks the
  // minimum).
  if (input.amount > workshop.priceCfa) {
    return { outcome: "TOO_MUCH", price: workshop.priceCfa };
  }

  const blocking = existing;
  // Neither case hands back the existing confirmation link: whoever types a
  // number isn't proven to own it, and that page shows the participant's
  // discount code.
  if (blocking?.status === "PAID") return { outcome: "ALREADY_PAID" };
  if (blocking) return { outcome: "IN_PROGRESS" };

  const provider = await getActivePaymentProvider(db);
  const registrationId = randomUUID();
  const idempotencyKey = `WORKSHOP:${registrationId}`;
  const token = randomBytes(24).toString("base64url");

  const [payment] = await db
    .insert(payments)
    .values({
      purpose: "WORKSHOP",
      method: "MOBILE_MONEY",
      amount: input.amount,
      provider: provider.name,
      idempotencyKey,
      status: "PENDING",
      metadata: {
        workshopRegistrationId: registrationId,
        participantName: input.fullName,
      },
    })
    .returning();

  await db.insert(workshopRegistrations).values({
    id: registrationId,
    workshopId: workshop.id,
    fullName: input.fullName,
    whatsapp: input.whatsapp,
    email: input.email,
    // The session's city, for the admin list and its export.
    city: workshop.city ?? "",
    amount: workshop.priceCfa,
    paymentId: payment.id,
    accessToken: token,
  });

  try {
    const intent = await provider.createPayment({
      amount: input.amount,
      description: workshop.city
        ? `${workshop.title} (${workshop.city})`
        : workshop.title,
      customer: {
        email: paymentEmail(input.email),
        ...splitName(input.fullName),
        phone: input.paymentPhone,
      },
      returnUrl: `${input.origin}/atelier-video-ia/merci?t=${token}`,
      idempotencyKey,
      metadata: { workshop_registration_id: registrationId },
      country: "TG",
      operator: input.operator,
      address: workshop.city || PAYMENT_ADDRESS,
    });
    await db
      .update(payments)
      .set({ providerReference: intent.providerReference })
      .where(eq(payments.id, payment.id));
    return { outcome: "STARTED", token, checkoutUrl: intent.checkoutUrl };
  } catch (err) {
    // The number can try again; the payment row stays for an admin.
    await db
      .update(workshopRegistrations)
      .set({ status: "FAILED" })
      .where(eq(workshopRegistrations.id, registrationId));
    throw err;
  }
}
