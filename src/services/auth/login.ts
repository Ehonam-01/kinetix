import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginInput } from "@/schemas/auth";

export async function loginUser(input: LoginInput) {
  const { email, password } = loginSchema.parse(input);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { error: error?.message ?? null };
}
