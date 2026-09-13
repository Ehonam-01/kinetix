import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { findAuthUserIdByEmail } from "@/repositories/auth-users";
import { findProfileByUsername } from "@/repositories/profiles";
import { registerSchema, type RegisterInput } from "@/schemas/auth";

export async function registerUser(input: RegisterInput) {
  const { fullName, username, email, password, sponsorEmail } =
    registerSchema.parse(input);

  // Resolved and validated up front so a typo'd sponsor email fails loudly
  // at registration time, instead of silently dropping the attribution
  // later in the email-confirmation callback.
  let sponsorId: string | null = null;
  if (sponsorEmail) {
    sponsorId = await findAuthUserIdByEmail(sponsorEmail);
    if (!sponsorId) {
      return { error: "Email de parrain introuvable." };
    }
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
