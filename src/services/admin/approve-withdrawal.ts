import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { processPayoutWebhookEvent } from "@/services/payments/handle-payout-webhook";
import { createPaydunyaPayout } from "@/services/payments/paydunya-payout";
import {
  PayoutRejectedError,
  PayoutUncertainError,
} from "@/services/payments/payout-errors";
import { logAdminAction } from "./audit-log";

// Thrown once a failed attempt's reason has already been saved on the
// request (payoutFailureReason) — the admin page shows it from there, so
// the action doesn't repeat it inline.
export class PayoutAttemptFailedError extends Error {}

// Admin-only. Sends the withdrawal through PayDunya's disbursement API —
// the same PayDunya account subscriptions are collected into, so there's
// no second provider balance to keep topped up (withdrawals used to go
// through Bictorys, whose merchant balance was empty since every payment
// came in through PayDunya — caught live on the first real withdrawal).
//
// The request is claimed (PENDING_REVIEW -> PROCESSING, WHERE-guarded)
// BEFORE any money moves, so a double click or two admins acting at once
// can never each send a transfer (security audit H4). Each attempt also
// carries its own disburse_id, which PayDunya refuses to process twice.
//
// Outcome: PayDunya reports success right away -> PAID immediately;
// pending -> PROCESSING until the callback or "Vérifier le statut"
// (sync-paydunya-payout.ts) settles it; explicitly refused or never
// submitted -> back to PENDING_REVIEW with the reason, safe to retry;
// uncertain -> stays PROCESSING with the reference, to be checked rather
// than re-sent.
export async function approveWithdrawal(
  adminUserId: string,
  requestId: string,
) {
  const admin = await db.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut valider un retrait.");
  }

  const request = await db.query.withdrawalRequests.findFirst({
    where: eq(withdrawalRequests.id, requestId),
  });
  if (!request) {
    throw new Error("Demande de retrait introuvable.");
  }
  if (request.status !== "PENDING_REVIEW") {
    throw new Error("Cette demande n'est plus en attente de validation.");
  }
  if (!request.operator || !request.country) {
    throw new Error(
      "Cette demande a été créée avant la sélection de l'opérateur/pays mobile money et ne peut pas être payée automatiquement.",
    );
  }
  const { operator, country } = request;

  const [claimed] = await db
    .update(withdrawalRequests)
    .set({
      status: "PROCESSING",
      reviewedBy: adminUserId,
      reviewedAt: sql`now()`,
      payoutFailureReason: null,
      // A previous attempt that failed at the operator left its reference
      // here — this attempt gets its own.
      payoutProviderReference: null,
    })
    .where(
      and(
        eq(withdrawalRequests.id, requestId),
        eq(withdrawalRequests.status, "PENDING_REVIEW"),
      ),
    )
    .returning();
  if (!claimed) {
    throw new Error("Cette demande n'est plus en attente de validation.");
  }

  // Real money movement — deliberately outside any DB transaction, so a
  // slow/failed call never holds a transaction open.
  let payout;
  try {
    payout = await createPaydunyaPayout({
      amount: claimed.amount,
      phone: claimed.payoutPhone,
      operator,
      country,
      disburseId: `${requestId}-${Date.now()}`,
      callbackUrl: `${new URL(getSiteEnv().SITE_URL).origin}/api/webhooks/providers/paydunya-payout`,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erreur inconnue.";
    if (err instanceof PayoutRejectedError) {
      // Refused or never submitted — nothing left the account.
      await db
        .update(withdrawalRequests)
        .set({
          status: "PENDING_REVIEW",
          reviewedBy: null,
          reviewedAt: null,
          payoutFailureReason: detail,
        })
        .where(
          and(
            eq(withdrawalRequests.id, requestId),
            eq(withdrawalRequests.status, "PROCESSING"),
            isNull(withdrawalRequests.payoutProviderReference),
          ),
        );
      throw new PayoutAttemptFailedError(detail);
    }
    // The transfer may have gone through: stays PROCESSING (can't be
    // re-approved), with the reference when one was obtained so its real
    // status can be checked.
    await db
      .update(withdrawalRequests)
      .set({
        payoutProviderReference:
          err instanceof PayoutUncertainError ? err.providerReference : null,
        payoutFailureReason:
          err instanceof PayoutUncertainError
            ? detail
            : `Résultat du virement incertain — vérifiez votre tableau de bord PayDunya avant toute nouvelle action. (${detail})`,
      })
      .where(eq(withdrawalRequests.id, requestId));
    throw new PayoutAttemptFailedError(detail);
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(withdrawalRequests)
      .set({ payoutProviderReference: payout.payoutProviderReference })
      .where(eq(withdrawalRequests.id, requestId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WITHDRAWAL_PAYOUT_INITIATED",
      targetType: "withdrawal_request",
      targetId: requestId,
      metadata: {
        userId: claimed.userId,
        amount: claimed.amount,
        payoutProviderReference: payout.payoutProviderReference,
        provider: "PAYDUNYA",
      },
    });

    if (payout.status === "success") {
      await processPayoutWebhookEvent(tx, {
        providerReference: payout.payoutProviderReference,
        status: "CONFIRMED",
        eventType: "paydunya-payout:success",
        dedupeKey: `paydunya-payout:${payout.payoutProviderReference}:success`,
        raw: { status: payout.status },
      });
    }

    return updated;
  });
}
