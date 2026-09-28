import { NextResponse } from "next/server";
import { parsePaydunyaPayoutCallback } from "@/services/payments/paydunya-payout";
import { syncPaydunyaPayout } from "@/services/payments/sync-paydunya-payout";

// callback_url of every PayDunya disbursement (services/admin/
// approve-withdrawal.ts). The callback is only a signal to look again: its
// hash (a constant SHA-512 of the master key) doesn't bind the payload, so
// the outcome applied is always the one PayDunya's check-status API
// returns (sync-paydunya-payout.ts), never the callback's own "status".
export async function POST(request: Request) {
  const rawBody = await request.text();

  let token: string;
  try {
    token = parsePaydunyaPayoutCallback(rawBody);
  } catch (error) {
    console.warn("Callback de virement PayDunya rejeté :", (error as Error).message);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
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
