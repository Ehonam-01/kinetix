import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { findPaymentByProviderReference } from "@/repositories/payments";
import { findWithdrawalRequestByPayoutReference } from "@/repositories/withdrawals";
import { bictorysProvider } from "@/services/payments/bictorys";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";
import { processPayoutWebhookEvent } from "@/services/payments/handle-payout-webhook";

// URL path fixed to /api/webhooks/providers/bictorys deliberately — it must
// match the "New webhook" URL entered in the Bictorys dashboard exactly
// (a mismatch here means every webhook 404s silently: Bictorys still
// thinks it delivered, but confirm-subscription-payment.ts never runs,
// leaving a real charge stuck PENDING forever — caught live in production
// this way, money already taken from a member with no account unlocked).
//
// One endpoint for both event kinds Bictorys sends this merchant account —
// charge/payment confirmations and payout/transfer confirmations — since
// the two aren't distinguishable by payload shape alone (both are just
// {id, status, amount, currency}, see bictorys.ts's webhook schema). Which
// one a given event is gets decided by which table actually has a row
// referencing it: a payments row (charge, forwarded to process-webhook-
// event.ts, unchanged from the Moneroo route's behavior) or a
// withdrawal_requests row (payout, forwarded to handle-payout-webhook.ts).
// Same 200-even-on-a-no-op policy as the Moneroo route for a reference
// neither table recognizes.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Secret-Key");

  let event;
  try {
    event = bictorysProvider.parseWebhook(rawBody, signature);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    const payment = await findPaymentByProviderReference(
      tx,
      event.providerReference,
    );
    if (payment) {
      await processWebhookEvent(tx, event);
      return;
    }

    const payoutRequest = await findWithdrawalRequestByPayoutReference(
      tx,
      event.providerReference,
    );
    if (payoutRequest) {
      await processPayoutWebhookEvent(tx, event);
    }
  });

  return NextResponse.json({ received: true });
}
