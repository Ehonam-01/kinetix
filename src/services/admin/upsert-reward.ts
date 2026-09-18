import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { rewards } from "@/db/schema/rewards";
import { logAdminAction } from "./audit-log";

// One active reward per level 3-5, admin-configured from scratch (the
// seeded phone/moto/car placeholders were cleared — migration 0040):
// updates the existing row for that level if one exists, otherwise
// creates it. Unlike commission_rules/parameter_versions, a reward isn't
// versioned — member_rewards snapshots nothing from it at unlock time
// besides the reference itself (services/mlm/reward.ts only reads
// reward.value at the moment CASH type is credited, and this catalog is
// PHYSICAL-only today), so editing in place is safe.
export async function upsertRewardCatalogEntry(
  adminUserId: string,
  input: {
    levelCode: number;
    name: string;
    description?: string;
    value: number;
  },
) {
  if (![3, 4, 5].includes(input.levelCode)) {
    throw new Error("Seuls les niveaux 3 à 5 ont une récompense matérielle.");
  }
  if (!input.name.trim()) {
    throw new Error("Le nom de la récompense est requis.");
  }
  if (!Number.isInteger(input.value) || input.value < 0) {
    throw new Error("La valeur doit être un entier positif ou nul.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut modifier le catalogue de récompenses.",
      );
    }

    const existing = await tx.query.rewards.findFirst({
      where: and(
        eq(rewards.levelCode, input.levelCode),
        eq(rewards.isActive, true),
      ),
    });

    const [reward] = existing
      ? await tx
          .update(rewards)
          .set({
            name: input.name,
            description: input.description || null,
            value: input.value,
          })
          .where(eq(rewards.id, existing.id))
          .returning()
      : await tx
          .insert(rewards)
          .values({
            levelCode: input.levelCode,
            name: input.name,
            description: input.description || null,
            value: input.value,
            rewardType: "PHYSICAL",
          })
          .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: existing ? "REWARD_CATALOG_UPDATED" : "REWARD_CATALOG_CREATED",
      targetType: "reward",
      targetId: reward.id,
      metadata: {
        levelCode: input.levelCode,
        name: input.name,
        value: input.value,
      },
    });

    return reward;
  });
}
