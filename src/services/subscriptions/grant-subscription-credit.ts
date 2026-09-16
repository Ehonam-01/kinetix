import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { logAdminAction } from "@/services/admin/audit-log";
import { confirmSubscriptionPurchase } from "./confirm-subscription-payment";

// Admin-only, mirrors services/payments/admin-credit.ts's grantAdminCredit.
// The one way to lift a permanently-frozen account (dashboard/layout.tsx,
// SubscriptionStatus.permanentlyFrozen — self-service payment no longer
// works past 3 months of non-renewal, explicit user decision): grants a
// full year, free, exactly as if the member had paid, going through the
// real confirmSubscriptionPurchase — so it counts toward the ambassador's
// first-subscription commission the same way a real payment would (same
// precedent as grantAdminCredit for REGISTRATION), and resets the freeze
// clock like any other renewal.
export async function grantSubscriptionCredit(
  adminUserId: string,
  beneficiaryUserId: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut accorder un abonnement.");
    }

    const amount = await getCurrentParameterValue(
      tx,
      "subscription.price_in_cfa",
    );

    const [payment] = await tx
      .insert(payments)
      .values({
        beneficiaryUserId,
        grantedByAdminId: adminUserId,
        purpose: "SUBSCRIPTION",
        method: "ADMIN_CREDIT",
        amount,
        status: "PENDING",
        idempotencyKey: `ADMIN_CREDIT:SUBSCRIPTION:${beneficiaryUserId}:${randomUUID()}`,
      })
      .returning();

    const activated = await confirmSubscriptionPurchase(tx, payment.id);

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SUBSCRIPTION_CREDIT_GRANTED",
      targetType: "profile",
      targetId: beneficiaryUserId,
      metadata: { amount, paymentId: payment.id },
    });

    return activated;
  });
}
