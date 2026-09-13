"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { approveWithdrawal } from "@/services/admin/approve-withdrawal";
import { rejectWithdrawal } from "@/services/admin/reject-withdrawal";

export async function approveWithdrawalAction(requestId: string) {
  const { profile } = await requireAdmin();
  try {
    await approveWithdrawal(profile.id, requestId);
    revalidatePath("/admin/withdrawals");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function rejectWithdrawalAction(
  requestId: string,
  reason: string,
) {
  const { profile } = await requireAdmin();
  try {
    await rejectWithdrawal(profile.id, requestId, reason);
    revalidatePath("/admin/withdrawals");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
