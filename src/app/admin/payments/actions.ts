"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  updatePaymentProvider,
  type PaymentProviderKey,
} from "@/services/admin/update-payment-provider";

export async function updatePaymentProviderAction(
  provider: PaymentProviderKey,
) {
  const { profile } = await requireAdmin();
  try {
    await updatePaymentProvider(profile.id, provider);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/payments");
  return { error: null };
}
