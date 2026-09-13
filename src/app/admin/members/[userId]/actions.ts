"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { setMemberStatus } from "@/services/admin/set-member-status";

export async function setMemberStatusAction(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  const { profile } = await requireAdmin();
  await setMemberStatus(profile.id, userId, status);
  revalidatePath(`/admin/members/${userId}`);
  revalidatePath("/admin/members");
}
