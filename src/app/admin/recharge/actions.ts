"use server";

import { revalidatePath } from "next/cache";
import { usernameSchema } from "@/schemas/auth";
import { findActiveProfileByUsername } from "@/repositories/profiles";
import { requireAdmin } from "@/services/auth/current-user";
import { confirmAdminRecharge } from "@/services/admin/confirm-recharge";
import { initiateAdminRecharge } from "@/services/admin/initiate-recharge";

export async function lookupMemberAction(username: string) {
  await requireAdmin();
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { fullName: null };
  const profile = await findActiveProfileByUsername(parsed.data);
  return { fullName: profile?.fullName ?? null };
}

export async function initiateRechargeAction(
  username: string,
  amount: number,
  reason?: string,
) {
  const { profile } = await requireAdmin();
  try {
    const request = await initiateAdminRecharge(
      profile.id,
      username,
      amount,
      reason,
    );
    return { requestId: request.id as string, error: null };
  } catch (err) {
    return {
      requestId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function confirmRechargeAction(requestId: string, code: string) {
  const { profile } = await requireAdmin();
  try {
    await confirmAdminRecharge(profile.id, requestId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/members");
  revalidatePath("/admin/audit-logs");
  return { error: null };
}
