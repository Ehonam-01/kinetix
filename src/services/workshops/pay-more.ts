import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { MIN_WORKSHOP_INSTALLMENT } from "@/schemas/workshop";
import {
  findLatestRegistrationPayment,
  findRegistrationByToken,
  getWorkshop,
} from "@/repositories/workshops";
import { getActivePaymentProvider } from "@/services/payments/provider-selector";
import { PAYMENT_ADDRESS, paymentEmail, splitName } from "./register";

// Same as a first payment: a prompt may still be on the phone.
const PENDING_WINDOW_MS = 5 * 60 * 1000;

type PayMoreInput = {
  token: string;
  operator: string;
  paymentPhone: string;
  amount: number;
  origin: string;
};

type PayMoreResult =
  | { outcome: "STARTED"; checkoutUrl: string | null }
  | { outcome: "REFUSED"; message: string };

// Another part towards a seat already held (status PAID with something
// left to pay), from the confirmation page, whose token is the proof of
// who this is. Like the first payment it confirms nothing by itself:
// confirmWorkshopRegistration adds it once the provider confirms it. Once
// the workshop has started, the rest is paid at the door (explicit user
// decision) and recorded from /admin/atelier.
export async function payMoreForWorkshop(
  input: PayMoreInput,
): Promise<PayMoreResult> {
  const registration = await findRegistrationByToken(db, input.token);
  if (!registration || registration.status !== "PAID") {
    return { outcome: "REFUSED", message: "Réservation introuvable." };
  }
  const left = registration.amount - registration.amountPaid;
  if (left <= 0) {
    return {
      outcome: "REFUSED",
      message: "Ta place est déjà entièrement payée.",
    };
  }
  const workshop = await getWorkshop(db);
  if (workshop.startsAt.getTime() <= Date.now()) {
    return {
      outcome: "REFUSED",
      message: "La masterclass a commencé : le reste se paie sur place.",
    };
  }
  if (input.amount > left) {
    return {
      outcome: "REFUSED",
      message: `Il ne te reste que ${left.toLocaleString("fr-FR")} F à payer.`,
    };
  }
  const minimum = Math.min(MIN_WORKSHOP_INSTALLMENT, left);
  if (input.amount < minimum) {
    return {
      outcome: "REFUSED",
      message: `Le montant minimum est de ${minimum.toLocaleString("fr-FR")} F.`,
    };
  }

  const latest = await findLatestRegistrationPayment(db, registration.id);
  if (
    latest?.status === "PENDING" &&
    latest.createdAt.getTime() > Date.now() - PENDING_WINDOW_MS
  ) {
    return {
      outcome: "REFUSED",
      message:
        "Un paiement est déjà en cours. Valide-le sur ton téléphone, ou réessaie dans 5 minutes.",
    };
  }

  const provider = await getActivePaymentProvider(db);
  const idempotencyKey = `WORKSHOP:${registration.id}:${randomUUID()}`;
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
        workshopRegistrationId: registration.id,
        participantName: registration.fullName,
      },
    })
    .returning();

  // A failure here leaves the payment PENDING for an admin, and the seat
  // as it was: nothing to undo.
  const intent = await provider.createPayment({
    amount: input.amount,
    description: workshop.title,
    customer: {
      email: paymentEmail(registration.email),
      ...splitName(registration.fullName),
      phone: input.paymentPhone,
    },
    returnUrl: `${input.origin}/atelier-video-ia/merci?t=${registration.accessToken}`,
    idempotencyKey,
    metadata: { workshop_registration_id: registration.id },
    country: "TG",
    operator: input.operator,
    address: PAYMENT_ADDRESS,
  });
  await db
    .update(payments)
    .set({ providerReference: intent.providerReference })
    .where(eq(payments.id, payment.id));
  return { outcome: "STARTED", checkoutUrl: intent.checkoutUrl };
}
