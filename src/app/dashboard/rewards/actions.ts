"use server";

import { revalidatePath } from "next/cache";
import { requireActiveMember } from "@/services/auth/current-user";
import { claimReward } from "@/services/mlm/claim-reward";

export async function claimRewardAction(
  memberRewardId: string,
  address?: string,
) {
  const { profile } = await requireActiveMember();
  await claimReward(
    profile.id,
    memberRewardId,
    address ? { address } : undefined,
  );
  revalidatePath("/dashboard/rewards");
}
