import "server-only";
import { cookies } from "next/headers";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "@/lib/pwned-password";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, type ResetPasswordInput } from "@/schemas/auth";
import { describeUpdateError, signOutOtherSessions } from "./password-security";
import {
  isValidRecoveryProof,
  RECOVERY_COOKIE_NAME,
} from "./password-recovery";
import { getAuthUser } from "./session";

export const RECOVERY_EXPIRED_MESSAGE =
  "Ce lien de réinitialisation a expiré ou n'est pas valide. Demandez-en un nouveau depuis « Mot de passe oublié ».";

// The new password from the recovery-email flow. Only for a session that
// came through that email within the last minutes (password-recovery.ts,
// security audit SEC-03) — any other session changes its password from
// Paramètres, which asks for the current one. Once changed, every other
// session of the account is signed out (SEC-04).
export async function updatePassword(input: ResetPasswordInput) {
  const { password } = resetPasswordSchema.parse(input);

  const user = await getAuthUser();
  const cookieStore = await cookies();
  if (
    !user ||
    !isValidRecoveryProof(cookieStore.get(RECOVERY_COOKIE_NAME)?.value, user.id)
  ) {
    return { error: RECOVERY_EXPIRED_MESSAGE };
  }
  if (await isRateLimited("passwordChange", `user:${user.id}`)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  if (await isPasswordPwned(password)) return { error: PWNED_PASSWORD_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Supabase's own wording stays in the log (security audit M8, SEC-09).
    console.error("Réinitialisation du mot de passe refusée :", error.code);
    return { error: describeUpdateError(error.code) };
  }

  cookieStore.delete(RECOVERY_COOKIE_NAME);
  await signOutOtherSessions(supabase);
  return { error: null };
}
