import { NextResponse } from "next/server";
import { parsePaydunyaPayoutCallback } from "@/services/payments/paydunya-payout";
import { syncPaydunyaPayout } from "@/services/payments/sync-paydunya-payout";

// callback_url of every PayDunya disbursement (services/admin/
// approve-withdrawal.ts). The callback is only a signal to look again: its
// hash (a constant SHA-512 of the master key) doesn't bind the payload, so
// the outcome applied is always the one PayDunya's check-status API
// returns (sync-paydunya-payout.ts), never the callback's own "status".
//
// Always answers 200, even to a request it ignores: PayDunya probes this URL
// when a disbursement is created (a request with no valid hash) and refuses
// the disbursement with 4002 "the callback is not accessible" unless it gets
// a success — caught live on the first real withdrawal, where the 400 this
// route used to return for an invalid hash blocked the payout. Answering
// 200 changes nothing security-wise: an unverified request is still never
// acted on.
export async function POST(request: Request) {
  const rawBody = await request.text();

  let token: string;
  try {
    token = parsePaydunyaPayoutCallback(rawBody);
  } catch (error) {
    console.warn(
      "Callback de virement PayDunya ignoré :",
      (error as Error).message,
    );
    return NextResponse.json({ received: true });
  }

  try {
    await syncPaydunyaPayout(token);
  } catch (error) {
    // check-status unreachable: the admin's "Vérifier le statut" button
    // (or PayDunya's next retry) picks it up later.
    console.error("Vérification du virement PayDunya impossible :", error);
  }
  return NextResponse.json({ received: true });
}

// Reachability checks (and the warm-up request approve-withdrawal.ts sends
// just before creating a disbursement) — nothing to do, just answer.
export async function GET() {
  return NextResponse.json({ ok: true });
}
