"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { updateParameter } from "@/services/admin/update-parameter";
import {
  cancelScheduledPriceChange,
  scheduleSubscriptionPriceChange,
} from "@/services/admin/schedule-price-change";

function revalidatePricePages() {
  revalidatePath("/admin/parameters");
  revalidatePath("/");
  revalidatePath("/programme-ambassadeur");
  revalidatePath("/businessplan");
}

// {error}-return, not a bare throw: an out-of-bounds value (e.g. a
// subscription price outside 100-1 000 000 F, services/admin/
// input-limits.ts) is an expected outcome the form shows inline — a thrown
// error would only reach a generic error page in production.
export async function updateParameterAction(
  parameterKey: string,
  value: number,
) {
  const { profile } = await requireAdmin();
  try {
    await updateParameter(profile.id, parameterKey, value);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/parameters");
  // The subscription price is shown on the public pages (homepage pricing,
  // ambassador page), both statically generated: refreshed right away.
  revalidatePath("/");
  revalidatePath("/programme-ambassadeur");
  revalidatePath("/businessplan");
  return { error: null };
}

export async function scheduleSubscriptionPriceChangeAction(
  newPrice: number,
  startDate: string,
) {
  const { profile } = await requireAdmin();
  try {
    await scheduleSubscriptionPriceChange(profile.id, { newPrice, startDate });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePricePages();
  return { error: null };
}

export async function cancelScheduledPriceChangeAction() {
  const { profile } = await requireAdmin();
  try {
    await cancelScheduledPriceChange(profile.id);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePricePages();
  return { error: null };
}
