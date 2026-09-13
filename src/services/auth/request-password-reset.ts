import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/schemas/auth";

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const { email } = forgotPasswordSchema.parse(input);
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { error: error?.message ?? null };
}
