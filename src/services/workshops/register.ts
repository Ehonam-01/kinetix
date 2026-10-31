import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { workshopRegistrations } from "@/db/schema/workshops";
import {
  findBlockingRegistration,
  getWorkshop,
  getWorkshopAvailability,
} from "@/repositories/workshops";
import { getActivePaymentProvider } from "@/services/payments/provider-selector";

// How long a payment just started blocks a new one for the same number: the
// prompt is still on the phone, and a double tap must not send a second one.
const PENDING_WINDOW_MS = 5 * 60 * 1000;

function splitName(fullName: string) {
  const [firstName, ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || firstName };
}

// PayDunya requires an email and this form doesn't: a mailbox of ours, never
// shown to the participant and never written to.
function paymentEmail(email: string | null) {
  return email ?? `atelier@${new URL(getSiteEnv().SITE_URL).hostname}`;
}

type RegisterInput = {
  fullName: string;
  whatsapp: string;
  email: string | null;
  city: string;
  operator: string;
  paymentPhone: string;
  origin: string;
};

type RegisterResult =
  | { outcome: "FULL" }
  | { outcome: "ALREADY_PAID" }
  | { outcome: "IN_PROGRESS" }
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
  const workshop = await getWorkshop(db);
  const { open } = await getWorkshopAvailability(db, workshop);
  if (!open) return { outcome: "FULL" };

  const blocking = await findBlockingRegistration(
    db,
    workshop.id,
    input.whatsapp,
    new Date(Date.now() - PENDING_WINDOW_MS),
  );
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
      amount: workshop.priceCfa,
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
    city: input.city,
    amount: workshop.priceCfa,
    paymentId: payment.id,
    accessToken: token,
  });

  try {
    const intent = await provider.createPayment({
      amount: workshop.priceCfa,
      description: workshop.title,
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
      // Moov Togo requires an address; the city is what this form has.
      address: input.city,
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
