import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { createBictorysPayout } from "@/services/payments/bictorys-payout";
import { logAdminAction } from "./audit-log";

// Admin-only. Triggers a real Bictorys payout and moves the request to
// PROCESSING — it does NOT mark it PAID: that only happens once the
// Bictorys webhook confirms the transfer actually succeeded
// (services/payments/handle-payout-webhook.ts moves pending_balance to
// withdrawn_balance and flips the ledger row PENDING -> COMPLETED at that
// point, not here). A payout that fails outright (API error) leaves the
// request untouched at PENDING_REVIEW so the admin can retry; a payout
// that's accepted but later reported as failed by the webhook reverts
// PROCESSING -> PENDING_REVIEW with payoutFailureReason set.
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

  const recipient = await db.query.profiles.findFirst({
    where: eq(profiles.id, request.userId),
  });
  if (!recipient) {
    throw new Error("Membre introuvable.");
  }

  // Real money movement — deliberately outside any DB transaction, so a
  // slow/failed call never holds a transaction open. The WHERE-guarded
  // UPDATE below is what actually commits the state change.
  const payout = await createBictorysPayout({
    amount: request.amount,
    phone: request.payoutPhone,
    operator: request.operator,
    country: request.country,
    recipientName: recipient.fullName,
  });

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(withdrawalRequests)
      .set({
        status: "PROCESSING",
        reviewedBy: adminUserId,
        reviewedAt: sql`now()`,
        payoutProviderReference: payout.payoutProviderReference,
      })
      .where(
        and(
          eq(withdrawalRequests.id, requestId),
          eq(withdrawalRequests.status, "PENDING_REVIEW"),
        ),
      )
      .returning();
    if (!updated) {
      throw new Error(
        "Cette demande n'est plus en attente de validation (un virement Bictorys a néanmoins été déclenché — vérifiez le tableau de bord Bictorys).",
      );
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WITHDRAWAL_PAYOUT_INITIATED",
      targetType: "withdrawal_request",
      targetId: requestId,
      metadata: {
        userId: request.userId,
        amount: request.amount,
        payoutProviderReference: payout.payoutProviderReference,
      },
    });

    return updated;
  });
}
