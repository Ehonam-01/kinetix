"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { upsertRewardCatalogEntry } from "@/services/admin/upsert-reward";
import { uploadRewardImage } from "@/services/admin/upload-reward-image";

export async function upsertRewardAction(input: {
  levelCode: number;
  name: string;
  description?: string;
  value: number;
}) {
  const { profile } = await requireAdmin();
  try {
    const reward = await upsertRewardCatalogEntry(profile.id, input);
    revalidatePath("/admin/levels");
    revalidatePath("/dashboard/levels");
    return { reward, error: null };
  } catch (err) {
    return {
      reward: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function uploadRewardImageAction(rewardId: string, file: File) {
  const { profile } = await requireAdmin();
  try {
    const imageUrl = await uploadRewardImage(profile.id, rewardId, file);
    revalidatePath("/admin/levels");
    revalidatePath("/dashboard/levels");
    return { imageUrl, error: null };
  } catch (err) {
    return {
      imageUrl: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
