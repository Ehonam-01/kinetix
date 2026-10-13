import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/services/auth/ensure-profile";
import {
  createRecoveryProof,
  RECOVERY_COOKIE_NAME,
  RECOVERY_REQUEST_COOKIE_NAME,
  recoveryCookieOptions,
} from "@/services/auth/password-recovery";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Creates the profile and records the registration sponsor on first
      // sign-in (ensure-profile.ts) — the same call every other sign-in
      // path goes through, so attribution no longer depends on this link
      // being opened in the signup browser. Binary tree placement is
      // deliberately not triggered here: it only happens once the
      // subscription payment is confirmed.
      await ensureProfile(data.user);

      // A reset link opened in the browser that asked for it (the request
      // cookie), or an old link still carrying next=/reset-password.
      const cookieStore = await cookies();
      const isRecovery =
        next === "/reset-password" ||
        cookieStore.has(RECOVERY_REQUEST_COOKIE_NAME);
      const response = NextResponse.redirect(
        `${origin}${isRecovery ? "/reset-password" : next}`,
      );
      // Coming from a password-recovery email: the reset form will only
      // accept a new password with this proof (services/auth/
      // password-recovery.ts, security audit SEC-03).
      if (isRecovery) {
        response.cookies.delete(RECOVERY_REQUEST_COOKIE_NAME);
        try {
          response.cookies.set(
            RECOVERY_COOKIE_NAME,
            createRecoveryProof(data.user.id),
            recoveryCookieOptions,
          );
        } catch (error) {
          // Signing key missing: the sign-in still goes through, only the
          // reset form will refuse (and say to ask for a new link).
          console.error("Preuve de réinitialisation impossible :", error);
        }
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
