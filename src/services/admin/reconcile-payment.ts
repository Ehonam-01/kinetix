import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { getPaymentProviderByName } from "@/services/payments/provider-selector";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";

// Manual safety net for a webhook that never arrived (a misconfigured
// callback URL, a delivery outage, ...) — the exact failure mode caught
// live in production: a Bictorys direct-softpay charge that actually
// succeeded (money taken) left stuck at PENDING forever because the
// webhook URL configured in Bictorys' dashboard didn't match this app's
// route. Checks the provider's own record of the payment directly via
// verifyPayment, then replays the exact same confirmation path a real
// webhook would have taken (processWebhookEvent) if it now reports
// CONFIRMED. Never invents a status: a payment the provider still reports
// PENDING or FAILED is left exactly as it was, nothing to reconcile yet.
export async function reconcilePayment(adminUserId: string, paymentId: string) {
  const admin = await db.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut vérifier un paiement.");
  }

  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) {
    throw new Error("Paiement introuvable.");
  }
  if (payment.status !== "PENDING") {
    throw new Error("Ce paiement n'est plus en attente.");
  }
  if (!payment.provider || !payment.providerReference) {
    throw new Error("Ce paiement n'a pas de référence fournisseur exploitable.");
  }

  const provider = getPaymentProviderByName(payment.provider);
  const verified = await provider.verifyPayment(payment.providerReference);

  const result = await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference: verified.providerReference,
      status: verified.status,
      eventType: "manual-reconcile",
      dedupeKey: `manual-reconcile:${payment.id}:${verified.status}`,
      raw: verified,
    }),
  );

  return { status: verified.status, processed: result.processed };
}
