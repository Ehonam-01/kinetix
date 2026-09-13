import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { logAdminAction } from "@/services/admin/audit-log";
import { activateRegistration } from "./activate-registration";

// Admin-only: validates a registration for free, no real money involved.
// Callers must already gate this behind requireAdmin() (section 2 of
// ARCHITECTURE.md) — the role is re-checked here too as defense in depth,
// since this is equivalent to granting free money.
export async function grantAdminCredit(
  adminUserId: string,
  beneficiaryUserId: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut accorder un crédit.");
    }

    const amount = await getCurrentParameterValue(tx, "registration_price");

    const [payment] = await tx
      .insert(payments)
      .values({
        beneficiaryUserId,
        grantedByAdminId: adminUserId,
        purpose: "REGISTRATION",
        method: "ADMIN_CREDIT",
        amount,
        status: "PENDING",
        idempotencyKey: `ADMIN_CREDIT:${beneficiaryUserId}:${randomUUID()}`,
      })
      .returning();

    const activated = await activateRegistration(tx, payment.id);

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "ADMIN_CREDIT_GRANTED",
      targetType: "profile",
      targetId: beneficiaryUserId,
      metadata: { amount, paymentId: payment.id },
    });

    return activated;
  });
}
