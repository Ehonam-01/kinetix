import "server-only";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "@/lib/pwned-password";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/schemas/auth";

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

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { error: "Mot de passe actuel incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  return {
    error: error ? "Impossible de modifier le mot de passe." : null,
  };
}
