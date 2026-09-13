import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { memberRewards } from "@/db/schema/rewards";

// Member-initiated: ELIGIBLE -> CLAIMED, optionally attaching a delivery
// address for physical rewards. No UI yet (Phase 8's /dashboard/rewards
// will call this) — the guard against claiming twice or claiming a reward
// that isn't ELIGIBLE lives in the WHERE clause, not just in application
// logic.
export async function claimReward(
  userId: string,
  memberRewardId: string,
  deliveryAddress?: Record<string, unknown>,
) {
  const [updated] = await db
    .update(memberRewards)
    .set({
      status: "CLAIMED",
      claimedAt: sql`now()`,
      deliveryAddress,
    })
    .where(
      and(
        eq(memberRewards.id, memberRewardId),
        eq(memberRewards.userId, userId),
        eq(memberRewards.status, "ELIGIBLE"),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error(
      "Récompense introuvable, ou déjà réclamée, ou n'appartenant pas à ce membre.",
    );
  }

  return updated;
}
