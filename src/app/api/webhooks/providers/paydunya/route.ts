import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { findPaymentByProviderReference } from "@/repositories/payments";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";
import { paydunyaProvider } from "@/services/payments/paydunya";

// URL passed as invoice.actions.callback_url on every checkout-invoice
// creation call (services/payments/paydunya.ts) — set per-request, not a
// fixed URL configured once in a dashboard like Bictorys', so the exact
// mismatch that broke Bictorys' webhook in production can't happen here.
//
// The IPN is treated as a signal only, never as the source of truth
// (security audit H5): PayDunya's "hash" is a constant SHA-512 of the
// master key — it doesn't bind the payload, so anyone who ever saw one IPN
// could forge others. The status and amount actually applied always come
// from PayDunya's own confirm endpoint (verifyPayment), the same call the
// dashboard/subscription polling already relies on.
export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = paydunyaProvider.parseWebhook(rawBody, null);
  } catch (error) {
    console.warn("Webhook PayDunya rejeté :", (error as Error).message);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const payment = await findPaymentByProviderReference(
    db,
    event.providerReference,
  );
  if (!payment) {
    return NextResponse.json({ received: true });
  }

  const verified = await paydunyaProvider.verifyPayment(
    event.providerReference,
  );
  if (verified.status === "PENDING") {
    return NextResponse.json({ received: true });
  }
  if (verified.status === "CONFIRMED" && verified.amount !== payment.amount) {
    console.error("PayDunya : montant confirmé incohérent", {
      paymentId: payment.id,
      expected: payment.amount,
      got: verified.amount,
    });
    return NextResponse.json({ received: true });
  }

  await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference: event.providerReference,
      status: verified.status,
      eventType: `ipn-verified:${verified.status}`,
      dedupeKey: `${event.providerReference}:${verified.status}`,
      raw: event.raw,
    }),
  );

  return NextResponse.json({ received: true });
}
