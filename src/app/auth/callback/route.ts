import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { findProfileById } from "@/repositories/profiles";
import { assignSponsor } from "@/services/genealogy/assign-sponsor";
import { ensureProfile } from "@/services/auth/ensure-profile";

const sponsorIdSchema = z.string().uuid();

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
      //
      // sponsor_id comes from user_metadata, which the user controls (see
      // ensure-profile.ts) — validated as a real, non-deleted, other
      // member before use, never passed straight through (a malformed or
      // unknown id used to 500 this route on the foreign key). Only ever
      // takes effect the first time: sponsorships is append-only
      // (assign-sponsor.ts).
      const parsedSponsorId = sponsorIdSchema.safeParse(
        data.user.user_metadata?.sponsor_id,
      );
      if (parsedSponsorId.success && parsedSponsorId.data !== data.user.id) {
        const sponsor = await findProfileById(parsedSponsorId.data);
        if (sponsor && sponsor.status !== "DELETED") {
          await assignSponsor(db, data.user.id, sponsor.id);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
