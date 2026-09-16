"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { setMemberStatus } from "@/services/admin/set-member-status";
import { grantSubscriptionCredit } from "@/services/subscriptions/grant-subscription-credit";

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
