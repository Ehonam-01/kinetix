import "server-only";
import { eq } from "drizzle-orm";
import { getTrustedOrigin } from "@/lib/trusted-origin";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { profiles } from "@/db/schema/profiles";
import { isPasswordPwned, PWNED_PASSWORD_MESSAGE } from "@/lib/pwned-password";
import { createClient } from "@/lib/supabase/server";
import {
  findActiveProfileByUsername,
  findProfileByUsername,
} from "@/repositories/profiles";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { findNetworkRootUserId } from "@/repositories/binary-nodes";
import type { GoalValue } from "@/config/goals";

// The platform's own account: the root of the network.
async function findPlatformSponsor() {
  const rootId = await findNetworkRootUserId(db);
  if (!rootId) return null;
  return db.query.profiles.findFirst({ where: eq(profiles.id, rootId) });
}

export async function registerUser(
  input: RegisterInput,
  extra: { goal?: GoalValue | null } = {},
) {
  const {
    fullName,
    username,
    email,
    whatsapp,
    password,
    sponsorUsername,
    noSponsor,
    wantsAmbassador,
  } = registerSchema.parse(input);

  // Resolved and validated up front so a typo'd sponsor pseudo fails loudly
  // at registration time, instead of silently dropping the attribution
  // later in the email-confirmation callback. sponsorUsername is a
  // mandatory schema field now (see schemas/auth.ts) — every registration
  // through this form names an existing member, no "no sponsor" case left
  // to handle here (the platform's own root account was created before
  // this rule existed).
  // No pseudo, "Je n'ai pas de parrain" ticked (the schema requires one or
  // the other): the visitor came on their own, and is attached to the
  // platform's own account — the root of the network.
  const sponsorProfile = sponsorUsername
    ? await findProfileByUsername(sponsorUsername)
    : await findPlatformSponsor();
  const declaredNoSponsor = !sponsorUsername && noSponsor === true;
  if (!sponsorProfile) {
    return {
      error: sponsorUsername
        ? "Pseudo de parrain introuvable."
        : "Inscription momentanément impossible. Réessayez dans un instant ou contactez-nous.",
    };
  }
  const sponsorId = sponsorProfile.id;

  // Same requirement join-program.ts enforces when the actual join happens
  // (once the subscription payment confirms — payment is mandatory before
  // anyone joins the program, wants_ambassador is only ever acted on
  // there), checked eagerly here for the same reason as the sponsor pseudo
  // above: failing now is loud and recoverable, failing at payment-webhook
  // time would roll back an already-paid subscription over a missing
  // sponsor.
  if (wantsAmbassador) {
    const sponsorAmbassador = await db.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, sponsorId),
    });
    if (!sponsorAmbassador || sponsorAmbassador.status !== "ACTIVE") {
      return {
        error:
          "Le parrain indiqué doit être un ambassadeur actif pour vous accueillir dans le programme.",
      };
    }
  }

  // Best-effort check — the profile row itself isn't created until email
  // confirmation (ensure-profile.ts), which re-resolves a collision if one
  // slips through this window, see repositories/profiles.ts.
  if (await findProfileByUsername(username)) {
    return { error: "Ce pseudo est déjà pris." };
  }

  if (await isPasswordPwned(password)) {
    return { error: PWNED_PASSWORD_MESSAGE };
  }

  const supabase = await createClient();
  const origin = await getTrustedOrigin();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        username,
        sponsor_id: sponsorId,
        wants_ambassador: wantsAmbassador ?? false,
        whatsapp,
        ...(extra.goal ? { goal: extra.goal } : {}),
        // Kept with the account: the new member declared having no sponsor
        // (the answer to a member claiming them later).
        ...(declaredNoSponsor ? { declared_no_sponsor: true } : {}),
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (!error) return { error: null };
  // Supabase's own wording stays in the log (security audit M8, SEC-09).
  console.error("Inscription refusée par Supabase :", error.code);
  switch (error.code) {
    case "weak_password":
      return {
        error:
          "Ce mot de passe est trop faible : choisissez-en un plus long ou plus varié.",
      };
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return {
        error:
          "Trop de demandes. Patientez quelques minutes avant de réessayer.",
      };
    // Same information Supabase's raw message gave before (only reported
    // when email confirmation is off, Supabase otherwise answers as if
    // the account were new).
    case "user_already_exists":
    case "email_exists":
      return {
        error:
          "Un compte existe déjà avec cette adresse. Connectez-vous ou utilisez « Mot de passe oublié ».",
      };
    case "email_address_invalid":
      return { error: "Cette adresse email n'est pas valide." };
    case "signup_disabled":
      return { error: "Les inscriptions sont momentanément fermées." };
    default:
      return {
        error:
          "Impossible de créer le compte pour le moment. Réessayez dans un instant.",
      };
  }
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
