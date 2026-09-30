import "server-only";
import { db } from "@/db/client";
import { findWithdrawalRequestByPayoutReference } from "@/repositories/withdrawals";
import { processPayoutWebhookEvent } from "./handle-payout-webhook";
import {
  checkPaydunyaPayoutStatus,
  type PaydunyaPayoutStatus,
} from "./paydunya-payout";
import { notifyWithdrawal } from "@/services/notifications/withdrawal-emails";

// Applies a PayDunya disbursement's real outcome to its withdrawal request —
// called by PayDunya's callback (app/api/webhooks/providers/paydunya-payout)
// and by the admin's "Vérifier le statut" button, both of which only say
// "look at this one again": the status always comes from check-status.
// success -> PAID (pending_balance -> withdrawn_balance); failed, or
// "created" (never reached the operator) -> back to PENDING_REVIEW so it
// can be retried; pending -> nothing to do yet. Idempotent through
// processPayoutWebhookEvent's WHERE status = 'PROCESSING' guard.
export async function syncPaydunyaPayout(
  providerReference: string,
): Promise<PaydunyaPayoutStatus | "unknown-request"> {
  const request = await findWithdrawalRequestByPayoutReference(
    db,
    providerReference,
  );
  if (!request) return "unknown-request";

  const status = await checkPaydunyaPayoutStatus(providerReference);
  if (status !== "pending") {
    const result = await db.transaction((tx) =>
      processPayoutWebhookEvent(tx, {
        providerReference,
        status: status === "success" ? "CONFIRMED" : "FAILED",
        eventType: `paydunya-payout:${status}`,
        dedupeKey: `paydunya-payout:${providerReference}:${status}`,
        raw: { status },
      }),
    );
    if (result.processed && result.outcome === "PAID") {
      await notifyWithdrawal(result.requestId, "PAID");
    }
  }
  return status;
}
