import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  findActiveProfileByUsername,
  findProfileByUsername,
} from "@/repositories/profiles";
import { registerSchema, type RegisterInput } from "@/schemas/auth";

export async function registerUser(input: RegisterInput) {
  const { fullName, username, email, password, sponsorUsername } =
    registerSchema.parse(input);

  // Resolved and validated up front so a typo'd sponsor pseudo fails loudly
  // at registration time, instead of silently dropping the attribution
  // later in the email-confirmation callback.
  let sponsorId: string | null = null;
  if (sponsorUsername) {
    const sponsorProfile = await findProfileByUsername(sponsorUsername);
    if (!sponsorProfile) {
      return { error: "Pseudo de parrain introuvable." };
    }
    sponsorId = sponsorProfile.id;
  }

  // Best-effort check — the profile row itself isn't created until email
  // confirmation (ensure-profile.ts), which re-resolves a collision if one
  // slips through this window, see repositories/profiles.ts.
  if (await findProfileByUsername(username)) {
    return { error: "Ce pseudo est déjà pris." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, username, sponsor_id: sponsorId },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  return { error: error?.message ?? null };
}

// Live "who am I about to name as sponsor?" preview on the registration
// form (register-form.tsx) — pseudo -> display name only, nothing else
// (no email, no status detail beyond excluding a suspended account as a
// valid sponsor, same as registerUser would reject at submit time
// anyway). Reachable without a session, like the rest of the
// registration page, so deliberately narrow in what it returns: a
// username is already effectively public elsewhere (referral links,
// the community directory), a full name tied to it a little less so.
export async function lookupSponsorByUsername(username: string) {
  const parsed = registerSchema.shape.sponsorUsername.safeParse(username);
  if (!parsed.success || !parsed.data) return null;

  const profile = await findActiveProfileByUsername(parsed.data);
  if (!profile) return null;

  return { fullName: profile.fullName };
}
