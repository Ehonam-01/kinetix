import "server-only";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env.public";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "@/lib/pwned-password";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema, type ChangePasswordInput } from "@/schemas/auth";

// Checks the current password on a throwaway client, never on the member's
// own session: signing in again on that session used to replace it with a
// password-only (aal1) one, so for an account with two-factor
// authentication — every admin — Supabase then refused the password change
// for lack of aal2, and the admin lost their verified session on top of it.
// The throwaway session is revoked right after.
async function isCurrentPassword(email: string, password: string) {
  const client = createStatelessClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;
  await client.auth.signOut({ scope: "local" }).catch(() => {});
  return true;
}

// What Supabase's refusals mean for the member (error codes from
// supabase.com/docs/guides/auth/debugging/error-codes); anything else is
// logged and gets the generic message.
function describeUpdateError(code: string | undefined): string {
  switch (code) {
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'actuel.";
    case "weak_password":
      return "Ce mot de passe est trop faible : choisissez-en un plus long ou plus varié.";
    case "insufficient_aal":
      return "Validez d'abord votre code de double authentification, puis réessayez.";
    case "reauthentication_needed":
    case "session_expired":
      return "Votre session est trop ancienne : déconnectez-vous, reconnectez-vous, puis réessayez.";
    default:
      return "Impossible de modifier le mot de passe. Réessayez dans un instant.";
  }
}

// Re-authenticates with the current password before changing it — the
// recovery-link flow (update-password.ts) doesn't, since proving control of
// the inbox is its own re-authentication.
export async function changePassword(input: ChangePasswordInput) {
  const { currentPassword, password } = changePasswordSchema.parse(input);
  if (await isPasswordPwned(password)) return { error: PWNED_PASSWORD_MESSAGE };
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "Session invalide, veuillez vous reconnecter." };
  }

  if (!(await isCurrentPassword(user.email, currentPassword))) {
    return { error: "Mot de passe actuel incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error(
      "Changement de mot de passe refusé :",
      error.code,
      error.message,
    );
    return { error: describeUpdateError(error.code) };
  }
  return { error: null };
}
