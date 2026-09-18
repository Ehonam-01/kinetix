import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import {
  paymentProviderEnum,
  paymentSettings,
} from "@/db/schema/payment-settings";
import { PAYMENT_SETTINGS_ID } from "@/repositories/payment-settings";
import { logAdminAction } from "./audit-log";

export type PaymentProviderKey = (typeof paymentProviderEnum.enumValues)[number];

// In-place update, deliberately unlike updateParameter (services/admin/
// update-parameter.ts) — see db/schema/payment-settings.ts for why this
// setting doesn't need parameter_versions' non-retroactive history. Only
// governs which provider handles new inbound charges (registration/
// subscription payments); withdrawal payouts are Bictorys-only regardless
// (services/admin/approve-withdrawal.ts calls it directly, not through this
// toggle).
export async function updatePaymentProvider(
  adminUserId: string,
  provider: PaymentProviderKey,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut changer le fournisseur de paiement.",
      );
    }

    const previous = await tx.query.paymentSettings.findFirst({
      where: eq(paymentSettings.id, PAYMENT_SETTINGS_ID),
    });

    await tx
      .insert(paymentSettings)
      .values({
        id: PAYMENT_SETTINGS_ID,
        activeProvider: provider,
        updatedBy: adminUserId,
      })
      .onConflictDoUpdate({
        target: paymentSettings.id,
        set: { activeProvider: provider, updatedBy: adminUserId, updatedAt: new Date() },
      });

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "PAYMENT_PROVIDER_CHANGED",
      targetType: "payment_settings",
      targetId: PAYMENT_SETTINGS_ID,
      metadata: {
        previousProvider: previous?.activeProvider ?? null,
        newProvider: provider,
      },
    });
  });
}
