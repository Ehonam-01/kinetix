import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth";

export async function updatePassword(input: ResetPasswordInput) {
  const { password } = resetPasswordSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  return { error: error?.message ?? null };
}
