"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { markOrientationRequestHandled } from "@/services/orientation/orientation-requests";

export async function markOrientationRequestHandledAction(requestId: string) {
  const { profile } = await requireAdmin();
  try {
    await markOrientationRequestHandled(profile.id, requestId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/orientation");
  return { error: null };
}
