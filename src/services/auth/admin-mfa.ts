import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AdminMfaState =
  // Session already passed the second factor (aal2).
  | { status: "verified" }
  // A TOTP factor is enrolled, this session hasn't entered a code yet.
  | { status: "needs-code" }
  // No verified factor yet: the admin has to enroll one first.
  | { status: "needs-enrollment" }
  // Supabase couldn't be asked — treated as not verified (fail closed).
  | { status: "unavailable" };

// Second factor (TOTP, Supabase Auth — free on every project) required for
// every admin page and action: the admin account validates withdrawals,
// recharges balances and sets commission rates, so a stolen password alone
// must not be enough. The session's access token is passed explicitly,
// which makes Supabase validate it and return the assurance level itself,
// rather than trusting a value decoded locally from the cookie.
export async function getAdminMfaState(): Promise<AdminMfaState> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { status: "unavailable" };

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
    session.access_token,
  );
  if (error || !data) return { status: "unavailable" };
  if (data.currentLevel === "aal2") return { status: "verified" };
  if (data.nextLevel === "aal2") return { status: "needs-code" };
  return { status: "needs-enrollment" };
}
