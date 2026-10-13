import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { paymentEvents, payments } from "@/db/schema/payments";
import { confirmSubscriptionPurchase } from "@/services/subscriptions/confirm-subscription-payment";
import { applyInstallmentDeposit } from "@/services/subscriptions/installments";
import { activateRegistration } from "./activate-registration";
import type { WebhookEvent } from "./provider";
import { alertAmountMismatch } from "@/services/notifications/admin-alerts";

// Shared by the real webhook route (app/api/webhooks/moneroo/route.ts) and
// verification scripts/tests — dedupes via payment_events.dedupe_key
// (unique constraint, ON CONFLICT DO NOTHING), then confirms or fails the
// matching payment. A second delivery of the same event, or an event for
// an unknown reference, is a safe no-op.
//
// Dispatches on payment.purpose: REGISTRATION still goes to
// activateRegistration, unchanged; SUBSCRIPTION goes to
// confirmSubscriptionPurchase instead (replaces the retired COURSE_PURCHASE
// per-course flow — see db/schema/subscriptions.ts). One webhook route, one
// payments table, two independent outcomes — never assume every confirmed
// payment is a registration.
//
// The payment row is locked first (FOR UPDATE): the same payment can be
// confirmed by several paths — the provider's webhook, the member's own
// status check, SasPay reconciliation, an admin reconcile — each with its
// own dedupe key. Without the lock, two of them landing together both saw
// it PENDING and both confirmed it: two subscriptions, two sponsor
// commissions, an installment deposit counted twice (security audit
// SEC-01). With it, the second waits, then sees CONFIRMED and does nothing.
export async function processWebhookEvent(tx: Executor, event: WebhookEvent) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.providerReference, event.providerReference))
    .for("update");

  const [inserted] = await tx
    .insert(paymentEvents)
    .values({
      paymentId: payment?.id,
      dedupeKey: event.dedupeKey,
      eventType: event.eventType,
      rawPayload: event.raw,
    })
    .onConflictDoNothing({ target: paymentEvents.dedupeKey })
    .returning();

  if (!inserted || !payment) {
    return { processed: false as const };
  }

  await tx
    .update(paymentEvents)
    .set({ processedAt: sql`now()` })
    .where(eq(paymentEvents.id, inserted.id));

  // A confirmation reporting another amount than the one charged is never
  // applied — left PENDING for an admin to look at, same rule as the
  // PayDunya and polling paths (security audit M7, SEC-06).
  if (
    event.status === "CONFIRMED" &&
    event.amount !== undefined &&
    event.amount !== payment.amount
  ) {
    alertAmountMismatch({
      source: `${payment.provider ?? "fournisseur"} (webhook)`,
      paymentId: payment.id,
      expected: payment.amount,
      got: event.amount,
    });
    return { processed: false as const };
  }

  if (event.status === "CONFIRMED") {
    if (payment.purpose === "SUBSCRIPTION") {
      await confirmSubscriptionPurchase(tx, payment.id);
    } else if (payment.purpose === "INSTALLMENT") {
      // A deposit towards an installment plan: activates the subscription
      // only once the plan is fully paid.
      await applyInstallmentDeposit(tx, payment.id);
    } else if (payment.purpose === "REGISTRATION") {
      await activateRegistration(tx, payment.id);
    }
  } else if (event.status === "FAILED") {
    // Only a payment still waiting can fail: a late "failed"/"reversed"
    // event must never turn a confirmed payment — whose subscription was
    // granted — into a FAILED one (security audit SEC-07).
    await tx
      .update(payments)
      .set({ status: "FAILED" })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")));
  }

  return { processed: true as const };
}
