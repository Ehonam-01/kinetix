import "server-only";
import { getAuthUser, getVerifiedSessionClaims } from "./session";

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
// must not be enough.
//
// Same answer as Supabase's getAuthenticatorAssuranceLevel, without its
// extra network call: the session was already validated by Supabase in
// this request (getAuthUser), so its access token's own "aal" claim is the
// current level, and the user's verified factors tell whether aal2 is
// reachable. Never trusts a token that isn't that validated user's, or
// that has expired (getVerifiedSessionClaims).
export async function getAdminMfaState(): Promise<AdminMfaState> {
  const user = await getAuthUser();
  if (!user) return { status: "unavailable" };
  const claims = await getVerifiedSessionClaims(user);
  if (!claims) return { status: "unavailable" };

  if (claims.aal === "aal2") return { status: "verified" };
  const hasVerifiedFactor = (user.factors ?? []).some(
    (f) => f.status === "verified",
  );
  return hasVerifiedFactor
    ? { status: "needs-code" }
    : { status: "needs-enrollment" };
}
