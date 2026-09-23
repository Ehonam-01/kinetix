import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { subscriptions } from "@/db/schema/subscriptions";
import { logAdminAction } from "./audit-log";

// The one place in the app that actually deletes a financial record rather
// than reversing or anonymizing it (see confirm-account-deletion.ts's own
// comment for why every other flow avoids this: other members' genealogy/
// commission history can reference an id and must stay valid). Exists only
// to correct a subscription that was never a real sale — a test/simulation
// run directly against production, confirmed explicitly by an admin each
// time, never for a real member's subscription however old or inactive.
//
// Refuses if the subscription ever attributed a commission to a referring
// ambassador: that payout already happened for real (a credited balance,
// a real financial_transactions row) and this function makes no attempt to
// reverse it — deleting the subscription underneath it would leave that
// commission orphaned, paid for a sale no longer in the record.
export async function deleteTestSubscription(
  adminUserId: string,
  subscriptionId: string,
) {
  const admin = await db.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut supprimer un abonnement.");
  }

  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.id, subscriptionId),
  });
  if (!subscription) {
    throw new Error("Abonnement introuvable.");
  }
  if (subscription.ambassadorUserId) {
    throw new Error(
      "Cet abonnement a attribué une commission à un ambassadeur — suppression bloquée pour éviter un paiement orphelin.",
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(subscriptions)
      .where(eq(subscriptions.id, subscriptionId));
    await tx.delete(payments).where(eq(payments.id, subscription.paymentId));

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "TEST_SUBSCRIPTION_DELETED",
      targetType: "subscription",
      targetId: subscriptionId,
      metadata: {
        buyerUserId: subscription.userId,
        pricePaid: subscription.pricePaid,
        paymentId: subscription.paymentId,
      },
    });
  });
}
