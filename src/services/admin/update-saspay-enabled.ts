import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { paymentSettings } from "@/db/schema/payment-settings";
import { PAYMENT_SETTINGS_ID } from "@/repositories/payment-settings";
import { logAdminAction } from "./audit-log";

// Switches "Autre pays / carte bancaire" (SasPay) on or off for members.
// PayDunya and the outside payment link are untouched either way, and a
// SasPay payment already started is still confirmed once paid.
export async function updateSaspayEnabled(
  adminUserId: string,
  enabled: boolean,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut modifier les moyens de paiement.",
      );
    }
    await tx
      .insert(paymentSettings)
      .values({
        id: PAYMENT_SETTINGS_ID,
        saspayEnabled: enabled,
        updatedBy: adminUserId,
      })
      .onConflictDoUpdate({
        target: paymentSettings.id,
        set: {
          saspayEnabled: enabled,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SASPAY_TOGGLED",
      targetType: "payment_settings",
      targetId: PAYMENT_SETTINGS_ID,
      metadata: { enabled },
    });
    return enabled;
  });
}
