import "server-only";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { db } from "@/db/client";
import {
  findProfileById,
  insertProfileIfMissing,
} from "@/repositories/profiles";
import { registerSchema, usernameSchema } from "@/schemas/auth";
import { assignSponsor } from "@/services/genealogy/assign-sponsor";

const sponsorIdSchema = z.string().uuid();

// user_metadata is user-controlled: the anon key is public, so anyone can
// call Supabase's /auth/v1/signup (or auth.updateUser) directly with
// arbitrary metadata, bypassing registerAction's schema entirely. Every
// field is re-validated against the same schema the registration form uses,
// falling back to a safe default instead of trusting it (security audit M3).
//
// The sponsor named at registration is recorded here, the moment the
// profile is created — not only in auth/callback/route.ts. That route only
// runs its logic when the email-confirmation link is opened in the same
// browser the member signed up in (PKCE); opened anywhere else (a phone's
// mail app, another device) Supabase still confirms the email, the member
// then signs in with their password, and the profile got created here with
// no sponsorship at all. A member who'd ticked "Devenir ambassadeur" then
// couldn't have their paid subscription confirmed (joinAmbassadorProgram
// fell through to createRootNode) — caught live in production.
export async function ensureProfile(user: User) {
  const existing = await findProfileById(user.id);
  if (existing) return existing;

  const parsedFullName = registerSchema.shape.fullName.safeParse(
    user.user_metadata?.full_name,
  );
  const parsedUsername = usernameSchema.safeParse(user.user_metadata?.username);
  const wantsAmbassador = user.user_metadata?.wants_ambassador === true;

  const profile = await insertProfileIfMissing({
    id: user.id,
    fullName: parsedFullName.success ? parsedFullName.data : "",
    username: parsedUsername.success
      ? parsedUsername.data
      : `membre_${user.id.slice(0, 8)}`,
    wantsAmbassador,
  });

  const parsedSponsorId = sponsorIdSchema.safeParse(
    user.user_metadata?.sponsor_id,
  );
  if (parsedSponsorId.success && parsedSponsorId.data !== user.id) {
    const sponsor = await findProfileById(parsedSponsorId.data);
    if (sponsor && sponsor.status !== "DELETED") {
      // Idempotent (unique on user_id) — safe even if two first requests
      // race each other into this branch.
      await assignSponsor(db, user.id, sponsor.id);
    }
  }

  return profile;
}
