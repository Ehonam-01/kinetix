import "server-only";
import { db } from "@/db/client";
import { findPaymentById } from "@/repositories/payments";
import { findRegistrationByToken } from "@/repositories/workshops";
import { alertAmountMismatch } from "@/services/notifications/admin-alerts";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";
import { getPaymentProviderByName } from "@/services/payments/provider-selector";

// Polled by the confirmation page while it waits, like
// checkSubscriptionConfirmedAction: it asks the provider itself rather than
// only waiting for a webhook, so a webhook that never arrives can't leave a
// real payment stuck. Only a status the provider reports is ever written,
// through the same path as a webhook.
export async function checkWorkshopRegistration(
  token: string,
): Promise<"PAID" | "FAILED" | "PENDING" | null> {
  const registration = await findRegistrationByToken(db, token);
  if (!registration) return null;
  if (registration.status !== "PENDING") return registration.status;
  if (!registration.paymentId) return "PENDING";

  const payment = await findPaymentById(db, registration.paymentId);
  if (!payment?.provider || !payment.providerReference) return "PENDING";

  const provider = getPaymentProviderByName(payment.provider);
  const verified = await provider.verifyPayment(payment.providerReference);
  if (verified.status === "PENDING") return "PENDING";
  if (verified.status === "CONFIRMED" && verified.amount !== payment.amount) {
    alertAmountMismatch({
      source: `${payment.provider} (page de confirmation de l'atelier)`,
      paymentId: payment.id,
      expected: payment.amount,
      got: verified.amount,
    });
    return "PENDING";
  }

  await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference: verified.providerReference,
      status: verified.status,
      eventType: "poll-reconcile",
      dedupeKey: `poll-reconcile:${payment.id}:${verified.status}`,
      raw: verified,
    }),
  );
  return verified.status === "CONFIRMED" ? "PAID" : "FAILED";
}
