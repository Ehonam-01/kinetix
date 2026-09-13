import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { paymentEvents, payments } from "@/db/schema/payments";
import { findPaymentByProviderReference } from "@/repositories/payments";
import { confirmCoursePurchase } from "@/services/sales/confirm-course-purchase";
import { activateRegistration } from "./activate-registration";
import type { WebhookEvent } from "./provider";

// Shared by the real webhook route (app/api/webhooks/moneroo/route.ts) and
// verification scripts/tests — dedupes via payment_events.dedupe_key
// (unique constraint, ON CONFLICT DO NOTHING), then confirms or fails the
// matching payment. A second delivery of the same event, or an event for
// an unknown reference, is a safe no-op.
//
// Dispatches on payment.purpose since Phase 11 (education-first pivot):
// REGISTRATION still goes to activateRegistration, unchanged; COURSE_PURCHASE
// goes to confirmCoursePurchase instead. One webhook route, one payments
// table, two independent outcomes — never assume every confirmed payment is
// a registration.
export async function processWebhookEvent(tx: Executor, event: WebhookEvent) {
  const payment = await findPaymentByProviderReference(
    tx,
    event.providerReference,
  );

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

  if (event.status === "CONFIRMED") {
    if (payment.purpose === "COURSE_PURCHASE") {
      await confirmCoursePurchase(tx, payment.id);
    } else {
      await activateRegistration(tx, payment.id);
    }
  } else if (event.status === "FAILED") {
    await tx
      .update(payments)
      .set({ status: "FAILED" })
      .where(eq(payments.id, payment.id));
  }

  return { processed: true as const };
}
