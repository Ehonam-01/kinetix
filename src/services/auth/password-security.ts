import "server-only";
import type { createClient } from "@/lib/supabase/server";

// What Supabase's refusals mean for the member (error codes from
// supabase.com/docs/guides/auth/debugging/error-codes); anything else is
// logged and gets the generic message.
export function describeUpdateError(code: string | undefined): string {
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

// After a password change, whoever else was signed in to the account
// (another device, a stolen session) is signed out: their refresh tokens
// are revoked, so they're out at the latest when their current access token
// expires (security audit SEC-04). Never fails the password change itself.
export async function signOutOtherSessions(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.error("Déconnexion des autres sessions impossible :", error.code);
  }
}
