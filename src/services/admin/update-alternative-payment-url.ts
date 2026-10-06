import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { paymentSettings } from "@/db/schema/payment-settings";
import { PAYMENT_SETTINGS_ID } from "@/repositories/payment-settings";
import { logAdminAction } from "./audit-log";

// An https address only; an empty input removes the link for members.
export function normalizePaymentUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      "Lien invalide : collez l'adresse complète, commençant par https://.",
    );
  }
  if (url.protocol !== "https:") {
    throw new Error("Le lien doit commencer par https://.");
  }
  return url.toString();
}

export async function updateAlternativePaymentUrl(
  adminUserId: string,
  input: string,
) {
  const value = normalizePaymentUrl(input);
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier ce lien.");
    }
    await tx
      .insert(paymentSettings)
      .values({
        id: PAYMENT_SETTINGS_ID,
        alternativePaymentUrl: value,
        updatedBy: adminUserId,
      })
      .onConflictDoUpdate({
        target: paymentSettings.id,
        set: {
          alternativePaymentUrl: value,
          updatedBy: adminUserId,
          updatedAt: new Date(),
        },
      });
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "ALTERNATIVE_PAYMENT_URL_UPDATED",
      targetType: "payment_settings",
      targetId: PAYMENT_SETTINGS_ID,
      metadata: { alternativePaymentUrl: value },
    });
    return value;
  });
}
