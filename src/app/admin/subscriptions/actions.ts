"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { deleteTestSubscription } from "@/services/admin/delete-test-subscription";

export async function deleteTestSubscriptionAction(subscriptionId: string) {
  const { profile } = await requireAdmin();
  try {
    await deleteTestSubscription(profile.id, subscriptionId);
    revalidatePath("/admin/subscriptions");
    // Both read subscriptions.pricePaid directly, so a deleted test row
    // must stop skewing them immediately, not just this list.
    revalidatePath("/admin");
    revalidatePath("/admin/audit-logs");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
