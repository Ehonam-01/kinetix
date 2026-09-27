import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/services/auth/ensure-profile";

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

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
