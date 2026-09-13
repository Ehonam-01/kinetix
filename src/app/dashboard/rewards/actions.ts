"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { claimReward } from "@/services/mlm/claim-reward";

export async function claimRewardAction(
  memberRewardId: string,
  address?: string,
) {
  const { profile } = await requireUser();
  await claimReward(
    profile.id,
    memberRewardId,
    address ? { address } : undefined,
  );
  revalidatePath("/dashboard/rewards");
}
