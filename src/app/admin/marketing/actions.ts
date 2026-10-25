"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { updateMetaPixelId } from "@/services/marketing/campaign-tracking";

export async function updateMetaPixelAction(input: string) {
  const { profile } = await requireAdmin();
  try {
    await updateMetaPixelId(profile.id, input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/marketing");
  return { error: null };
}
