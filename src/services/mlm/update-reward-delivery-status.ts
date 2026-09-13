import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { memberRewards } from "@/db/schema/rewards";
import { logAdminAction } from "@/services/admin/audit-log";

// Admin-only: moves a reward through PROCESSING/DELIVERED once claimed —
// the ADMIN role is re-checked here too, same defense-in-depth reasoning as
// services/payments/admin-credit.ts.
export async function updateRewardDeliveryStatus(
  adminUserId: string,
  memberRewardId: string,
  status: "PROCESSING" | "DELIVERED",
  trackingInfo?: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut mettre à jour la livraison d'une récompense.",
      );
    }

    const [updated] = await tx
      .update(memberRewards)
      .set({
        status,
        trackingInfo,
        deliveredAt: status === "DELIVERED" ? sql`now()` : undefined,
      })
      .where(eq(memberRewards.id, memberRewardId))
      .returning();

    if (!updated) {
      throw new Error("Récompense introuvable.");
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "REWARD_DELIVERY_UPDATED",
      targetType: "member_reward",
      targetId: memberRewardId,
      metadata: { status, trackingInfo },
    });

    return updated;
  });
}
