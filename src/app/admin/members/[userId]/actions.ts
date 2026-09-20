"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { setMemberStatus } from "@/services/admin/set-member-status";
import { confirmAccountDeletion } from "@/services/account/confirm-account-deletion";
import { requestAccountDeletion } from "@/services/account/request-account-deletion";
import { grantSubscriptionCredit } from "@/services/subscriptions/grant-subscription-credit";
import { creditMemberBalance } from "@/services/admin/credit-member-balance";

export async function setMemberStatusAction(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  const { profile } = await requireAdmin();
  await setMemberStatus(profile.id, userId, status);
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
}

// The one way to lift a permanently-frozen account (repositories/subscriptions.ts's
// permanentlyFrozen — self-service payment stops working 3 months after a
// lapsed renewal, explicit user decision). Grants a real, free year, exactly
// as if the member had paid.
export async function grantSubscriptionCreditAction(userId: string) {
  const { profile } = await requireAdmin();
  await grantSubscriptionCredit(profile.id, userId);
  revalidatePath(`/admin/members/${userId}`);
}

export async function creditMemberBalanceAction(
  userId: string,
  amount: number,
  reason?: string,
) {
  const { profile } = await requireAdmin();
  try {
    await creditMemberBalance(profile.id, userId, amount, reason);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath(`/admin/members/${userId}`);
  return { error: null };
}

export async function requestMemberDeletionAction(userId: string) {
  const { profile } = await requireAdmin();
  try {
    const request = await requestAccountDeletion(profile.id, userId);
    return { requestId: request.id as string, error: null };
  } catch (err) {
    return {
      requestId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function confirmMemberDeletionAction(
  userId: string,
  requestId: string,
  code: string,
) {
  const { profile } = await requireAdmin();
  try {
    await confirmAccountDeletion(profile.id, requestId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
  return { error: null };
}
