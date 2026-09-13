"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { updateParameter } from "@/services/admin/update-parameter";

export async function updateParameterAction(
  parameterKey: string,
  value: number,
) {
  const { profile } = await requireAdmin();
  await updateParameter(profile.id, parameterKey, value);
  revalidatePath("/admin/parameters");
}
