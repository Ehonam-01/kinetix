"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { updateRewardDeliveryStatus } from "@/services/mlm/update-reward-delivery-status";

export async function updateRewardDeliveryStatusAction(
  memberRewardId: string,
  status: "PROCESSING" | "DELIVERED",
) {
  const { profile } = await requireAdmin();
  await updateRewardDeliveryStatus(profile.id, memberRewardId, status);
  revalidatePath("/admin/rewards");
}
