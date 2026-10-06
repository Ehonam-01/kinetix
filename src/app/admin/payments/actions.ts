"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  updatePaymentProvider,
  type PaymentProviderKey,
} from "@/services/admin/update-payment-provider";
import { reconcilePayment } from "@/services/admin/reconcile-payment";
import { updateSupportWhatsapp } from "@/services/admin/update-support-whatsapp";
import { updateAlternativePaymentUrl } from "@/services/admin/update-alternative-payment-url";
import { updateSaspayEnabled } from "@/services/admin/update-saspay-enabled";

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

export async function updateSupportWhatsappAction(input: string) {
  const { profile } = await requireAdmin();
  try {
    const number = await updateSupportWhatsapp(profile.id, input);
    revalidatePath("/admin/payments");
    revalidatePath("/dashboard/subscription");
    revalidatePath("/dashboard/withdrawals");
    return { number, error: null };
  } catch (err) {
    return {
      number: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function updateAlternativePaymentUrlAction(input: string) {
  const { profile } = await requireAdmin();
  try {
    const url = await updateAlternativePaymentUrl(profile.id, input);
    revalidatePath("/admin/payments");
    revalidatePath("/dashboard/subscription");
    return { url, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function updateSaspayEnabledAction(enabled: boolean) {
  const { profile } = await requireAdmin();
  try {
    await updateSaspayEnabled(profile.id, enabled);
    revalidatePath("/admin/payments");
    revalidatePath("/dashboard/subscription");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
