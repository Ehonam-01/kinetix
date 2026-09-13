import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { monerooProvider } from "@/services/payments/moneroo";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";

// Moneroo requires a 200 within 3 seconds and retries otherwise
// (introduction/webhooks.md) — an invalid signature is the only case
// that's actually rejected (400); anything else (duplicate delivery,
// unknown reference, successfully processed) returns 200, since we've
// already handled it as gracefully as we can.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Moneroo-Signature");

  let event;
  try {
    event = monerooProvider.parseWebhook(rawBody, signature);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  await db.transaction((tx) => processWebhookEvent(tx, event));

  return NextResponse.json({ received: true });
}
