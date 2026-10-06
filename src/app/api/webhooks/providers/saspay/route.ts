import { NextResponse } from "next/server";
import { verifySaspayWebhook } from "@/services/payments/saspay";
import { reconcilePendingSaspayPayments } from "@/services/payments/saspay-reconcile";

// The URL to enter in the SasPay dashboard (Webhooks), subscribed to
// transaction.success and transaction.failed:
//   https://<site>/api/webhooks/providers/saspay
//
// SasPay signs each delivery (X-Webhook-Signature over
// "<X-Webhook-Timestamp>.<raw body>"); anything unsigned, badly signed or
// older than 5 minutes is refused. A valid event names SasPay's
// transaction, not the checkout session our payments row keeps, so it
// triggers a re-check of our pending SasPay payments against SasPay itself
// — the payment is only ever confirmed on what SasPay's API reports, never
// on the webhook's body.
export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    verifySaspayWebhook(
      rawBody,
      request.headers.get("X-Webhook-Signature"),
      request.headers.get("X-Webhook-Timestamp"),
    );
  } catch (error) {
    // Detail stays in the server log (security audit M8).
    console.warn("Webhook SasPay rejeté :", (error as Error).message);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const event = request.headers.get("X-Webhook-Event") ?? "";
  if (event.startsWith("transaction.")) {
    await reconcilePendingSaspayPayments();
  }
  return NextResponse.json({ received: true });
}
