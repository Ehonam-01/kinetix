import "server-only";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "@/lib/pwned-password";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth";

export async function updatePassword(input: ResetPasswordInput) {
  const { password } = resetPasswordSchema.parse(input);
  if (await isPasswordPwned(password)) return { error: PWNED_PASSWORD_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  return { error: error?.message ?? null };
}
