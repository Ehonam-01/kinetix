import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { paymentSettings } from "@/db/schema/payment-settings";
import { PAYMENT_SETTINGS_ID } from "@/repositories/payment-settings";
import { logAdminAction } from "./audit-log";

// "+228 90 00 00 00", "00228 90000000", "22890000000" → "22890000000": the
// international number, digits only, as a wa.me link wants it. An empty
// input clears the number (the hint disappears for members).
export function normalizeWhatsappNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d{8,15}$/.test(digits)) {
    throw new Error(
      "Numéro invalide : saisissez le numéro international avec l'indicatif du pays, par exemple +228 90 00 00 00.",
    );
  }
  return digits;
}

export async function updateSupportWhatsapp(
  adminUserId: string,
  input: string,
) {
  const number = normalizeWhatsappNumber(input);
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut modifier le contact du support.",
      );
    }

    await tx
      .insert(paymentSettings)
      .values({
        id: PAYMENT_SETTINGS_ID,
        supportWhatsapp: number,
        updatedBy: adminUserId,
      })
      .onConflictDoUpdate({
        target: paymentSettings.id,
        set: {
          supportWhatsapp: number,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SUPPORT_WHATSAPP_UPDATED",
      targetType: "payment_settings",
      targetId: PAYMENT_SETTINGS_ID,
      metadata: { supportWhatsapp: number },
    });

    return number;
  });
}
