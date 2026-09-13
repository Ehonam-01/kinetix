"use server";

import { redirect } from "next/navigation";
import { resetPasswordSchema } from "@/schemas/auth";
import { updatePassword } from "@/services/auth/update-password";

export async function resetPasswordAction(input: unknown) {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { error } = await updatePassword(parsed.data);
  if (error) return { error };

  redirect("/login?reset=success");
}
