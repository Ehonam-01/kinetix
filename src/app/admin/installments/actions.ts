"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { markInstallmentRefunded } from "@/services/subscriptions/installments";

export async function markInstallmentRefundedAction(planId: string) {
  const { profile } = await requireAdmin();
  try {
    await markInstallmentRefunded(profile.id, planId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/installments");
  return { error: null };
}
