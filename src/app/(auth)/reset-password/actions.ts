"use server";

import { redirect } from "next/navigation";
import { resetPasswordSchema } from "@/schemas/auth";
import {
  updatePassword,
  type UpdatePasswordResult,
} from "@/services/auth/update-password";

export async function resetPasswordAction(
  input: unknown,
  mfaCode?: unknown,
): Promise<UpdatePasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await updatePassword(
    parsed.data,
    typeof mfaCode === "string" ? mfaCode : undefined,
  );
  if (result.error) return result;

  redirect("/login?reset=success");
}
