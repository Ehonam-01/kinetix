import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { processWebhookEvent } from "./process-webhook-event";
import { saspayProvider } from "./saspay";

// How far back a pending SasPay payment is still worth checking: a
// checkout session left unpaid that long won't be paid any more.
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

// Re-checks every recent PENDING SasPay payment with SasPay itself, and
// confirms or fails it through the same path as any webhook
// (processWebhookEvent: subscription, installment deposit...). Run when
// SasPay signals a transaction (its webhooks name the transaction, not
// our checkout session) and by the daily cron as a safety net — the
// member's own page also polls while they wait.
//
// Only a status SasPay reports is ever written, and a confirmed amount
// that isn't the one we asked for is left PENDING for an admin, same rule
// as checkSubscriptionConfirmedAction.
export async function reconcilePendingSaspayPayments(): Promise<{
  confirmed: number;
  failed: number;
}> {
  let confirmed = 0;
  let failed = 0;
  const pending = await db.query.payments.findMany({
    where: and(
      eq(payments.provider, "SASPAY"),
      eq(payments.status, "PENDING"),
      gt(payments.createdAt, new Date(Date.now() - LOOKBACK_MS)),
    ),
  });

  for (const payment of pending) {
    if (!payment.providerReference) continue;
    try {
      const verified = await saspayProvider.verifyPayment(
        payment.providerReference,
      );
      if (verified.status === "PENDING") continue;
      if (
        verified.status === "CONFIRMED" &&
        verified.amount !== payment.amount
      ) {
        console.error("SasPay : montant confirmé incohérent", {
          paymentId: payment.id,
          expected: payment.amount,
          got: verified.amount,
        });
        continue;
      }
      await db.transaction((tx) =>
        processWebhookEvent(tx, {
          providerReference: payment.providerReference!,
          status: verified.status,
          eventType: "saspay-reconcile",
          dedupeKey: `saspay-reconcile:${payment.id}:${verified.status}`,
          raw: verified,
        }),
      );
      if (verified.status === "CONFIRMED") confirmed += 1;
      else failed += 1;
    } catch (err) {
      console.error(
        `Vérification SasPay impossible (paiement ${payment.id}) :`,
        err,
      );
    }
  }
  return { confirmed, failed };
}
