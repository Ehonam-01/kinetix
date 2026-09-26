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

  if (!error) return { error: null };

  // Never Supabase's raw message (security audit M8). "Email not confirmed"
  // is kept distinct because Supabase only reports it once the password
  // itself checked out, so it reveals nothing to someone guessing.
  if (error.code === "email_not_confirmed") {
    return {
      error:
        "Votre adresse email n'est pas encore confirmée. Consultez le lien reçu par email.",
    };
  }
  if (error.status === 429) {
    return { error: "Trop de tentatives. Veuillez patienter avant de réessayer." };
  }
  return { error: "Email ou mot de passe incorrect." };
}
