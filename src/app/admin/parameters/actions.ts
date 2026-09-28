"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { updateParameter } from "@/services/admin/update-parameter";

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
  return { error: null };
}
