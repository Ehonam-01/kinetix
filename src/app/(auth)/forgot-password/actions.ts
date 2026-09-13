"use server";

import { forgotPasswordSchema } from "@/schemas/auth";
import { requestPasswordReset } from "@/services/auth/request-password-reset";

export async function forgotPasswordAction(input: unknown) {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  return requestPasswordReset(parsed.data);
}
