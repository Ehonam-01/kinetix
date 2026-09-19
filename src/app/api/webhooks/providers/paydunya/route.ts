import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";
import { paydunyaProvider } from "@/services/payments/paydunya";

// URL passed as invoice.actions.callback_url on every checkout-invoice
// creation call (services/payments/paydunya.ts) — set per-request, not a
// fixed URL configured once in a dashboard like Bictorys', so the exact
// mismatch that broke Bictorys' webhook in production can't happen here.
// PayDunya's IPN payload shape isn't fully documented (see paydunya.ts's
// parseWebhook comment) — this route is a best-effort primary path, not
// the only one: dashboard/subscription's polling independently re-verifies
// via verifyPayment regardless of whether this ever fires correctly.
export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = paydunyaProvider.parseWebhook(rawBody, null);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  await db.transaction((tx) => processWebhookEvent(tx, event));

  return NextResponse.json({ received: true });
}
