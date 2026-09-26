import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import {
  createBictorysPayout,
  PayoutRejectedError,
} from "@/services/payments/bictorys-payout";
import { logAdminAction } from "./audit-log";

// Admin-only. Triggers a real Bictorys payout and moves the request to
// PROCESSING — it does NOT mark it PAID: that only happens once the
// Bictorys webhook confirms the transfer actually succeeded
// (services/payments/handle-payout-webhook.ts moves pending_balance to
// withdrawn_balance and flips the ledger row PENDING -> COMPLETED at that
// point, not here). A payout that's accepted but later reported as failed
// by the webhook reverts PROCESSING -> PENDING_REVIEW with
// payoutFailureReason set.
//
// The request is claimed (PENDING_REVIEW -> PROCESSING, WHERE-guarded)
// BEFORE any money moves — the reverse order let a double click or two
// admins acting at once each trigger their own real Bictorys transfer,
// the second one only failing after its money had already gone out
// (security audit H4). Only one caller can ever win the claim.
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

  const recipient = await db.query.profiles.findFirst({
    where: eq(profiles.id, request.userId),
  });
  if (!recipient) {
    throw new Error("Membre introuvable.");
  }

  const [claimed] = await db
    .update(withdrawalRequests)
    .set({
      status: "PROCESSING",
      reviewedBy: adminUserId,
      reviewedAt: sql`now()`,
      payoutFailureReason: null,
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
    payout = await createBictorysPayout({
      amount: claimed.amount,
      phone: claimed.payoutPhone,
      operator,
      country,
      recipientName: recipient.fullName,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Erreur inconnue.";
    if (err instanceof PayoutRejectedError) {
      // Explicitly refused — nothing left the account, safe to retry.
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
      throw err;
    }
    // Ambiguous (network failure, timeout, 5xx) — the transfer may have
    // gone through. Stays PROCESSING so it can't be re-approved blindly;
    // an admin has to check the Bictorys dashboard before doing anything.
    await db
      .update(withdrawalRequests)
      .set({
        payoutFailureReason: `Résultat du virement incertain — vérifiez le tableau de bord Bictorys avant toute nouvelle action. (${detail})`,
      })
      .where(eq(withdrawalRequests.id, requestId));
    throw new Error(
      "Résultat du virement incertain : vérifiez le tableau de bord Bictorys avant toute nouvelle action.",
    );
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
      },
    });

    return updated;
  });
}
