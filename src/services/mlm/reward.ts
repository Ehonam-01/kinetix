import "server-only";
import { and, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { memberRewards, rewards } from "@/db/schema/rewards";
import { creditBalance } from "./credit-balance";

// Called from unlock-level.ts's completeLevel for levels 3-5. Distinct
// from commissions (section 17): the reward goes to the member who just
// completed the level, not to their ancestors, and its value is never
// treated as a commission. Grants every currently active reward for that
// level — usually exactly one (the seeded phone/moto/car), but the schema
// allows an admin to configure more than one without a migration.
export async function unlockReward(
  tx: Executor,
  userId: string,
  levelCode: number,
) {
  const activeRewards = await tx.query.rewards.findMany({
    where: and(eq(rewards.levelCode, levelCode), eq(rewards.isActive, true)),
  });

  const unlocked = [];
  for (const reward of activeRewards) {
    const [row] = await tx
      .insert(memberRewards)
      .values({ userId, rewardId: reward.id })
      .onConflictDoNothing({
        target: [memberRewards.userId, memberRewards.rewardId],
      })
      .returning();

    if (!row) continue;

    // A CASH reward is literally money — credited like a commission. A
    // PHYSICAL/VOUCHER/OTHER reward's value is never added to the balance
    // (section 17: never treat a material reward's value as a commission).
    if (reward.rewardType === "CASH") {
      await tx.insert(financialTransactions).values({
        userId,
        type: "REWARD",
        amount: reward.value,
        reference: row.id,
        relatedLevel: levelCode,
      });
      await creditBalance(tx, userId, reward.value);
    }

    unlocked.push(row);
  }

  return unlocked;
}
