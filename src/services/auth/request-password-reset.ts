import "server-only";
import { getTrustedOrigin } from "@/lib/trusted-origin";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/schemas/auth";

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const { email } = forgotPasswordSchema.parse(input);
  const supabase = await createClient();
  const origin = await getTrustedOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (!error) return { error: null };
  // Supabase's own wording stays in the log (security audit M8, SEC-09).
  console.error("Envoi du lien de réinitialisation impossible :", error.code);
  return {
    error:
      error.status === 429
        ? "Trop de demandes. Patientez quelques minutes avant de réessayer."
        : "Impossible d'envoyer le lien pour le moment. Réessayez dans un instant.",
  };
}
