import "server-only";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env.public";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "@/lib/pwned-password";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema, type ChangePasswordInput } from "@/schemas/auth";
import { describeUpdateError, signOutOtherSessions } from "./password-security";

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
  // Other devices and sessions are signed out (security audit SEC-04).
  await signOutOtherSessions(supabase);
  return { error: null };
}
