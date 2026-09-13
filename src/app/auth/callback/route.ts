import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { assignSponsor } from "@/services/genealogy/assign-sponsor";
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
      await ensureProfile(data.user);

      // Sponsor attribution happens once, right after the profile exists —
      // before payment/activation (section 5 of the master prompt). Binary
      // tree placement is deliberately not triggered here: it only happens
      // once registration payment is confirmed (Phase 5).
      const sponsorId = data.user.user_metadata?.sponsor_id;
      if (typeof sponsorId === "string") {
        await assignSponsor(db, data.user.id, sponsorId);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
