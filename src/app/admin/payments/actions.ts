"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  updatePaymentProvider,
  type PaymentProviderKey,
} from "@/services/admin/update-payment-provider";
import { reconcilePayment } from "@/services/admin/reconcile-payment";

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

// Manual safety net for a PENDING payment whose webhook never arrived —
// see services/admin/reconcile-payment.ts.
export async function reconcilePaymentAction(paymentId: string) {
  const { profile } = await requireAdmin();
  try {
    const result = await reconcilePayment(profile.id, paymentId);
    revalidatePath("/admin/payments");
    return { result, error: null };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
