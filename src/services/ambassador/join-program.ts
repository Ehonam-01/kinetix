import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { profiles } from "@/db/schema/profiles";
import { sponsorships } from "@/db/schema/sponsorships";
import { assignSponsor } from "@/services/genealogy/assign-sponsor";
import { createRootNode, placeMember } from "@/services/genealogy/place-member";
import { unlockLevel } from "@/services/mlm/unlock-level";

// Bumped whenever the ambassador program's terms actually change — the
// caller is expected to pass this explicitly rather than the service
// assuming it, so a row always records the exact version the member
// actually saw, not just "whatever was current".
export const AMBASSADOR_TERMS_VERSION = "v1";

// Takes an Executor (not a fixed db) so it can run either standalone
// (joinAmbassadorProgramInNewTransaction, dashboard/become-ambassador's own
// flow) or inside confirm-subscription-payment.ts's existing transaction,
// right after a payment activates the buyer — the registration form's
// "Devenir ambassadeur" checkbox (profiles.wants_ambassador) is only ever
// acted on there, since payment is now mandatory before anyone can join
// (explicit product decision, reverses the earlier free-opt-in model this
// function used to implement — see git history for that version). Under
// the new model, the direct commission stays reconceived as "on an
// eligible sale" (confirm-subscription-payment.ts), never paid here.
export async function joinAmbassadorProgram(
  tx: Executor,
  userId: string,
  input: { sponsorUsername?: string; termsVersion: string },
) {
  const profile = await tx.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  if (!profile) {
    throw new Error("Profil introuvable.");
  }
  if (profile.status === "SUSPENDED") {
    throw new Error(
      "Un compte suspendu ne peut pas rejoindre le programme ambassadeur.",
    );
  }
  if (profile.status !== "ACTIVE") {
    throw new Error(
      "Vous devez d'abord payer votre abonnement pour rejoindre le programme ambassadeur.",
    );
  }

  const existing = await tx.query.ambassadorProfiles.findFirst({
    where: eq(ambassadorProfiles.userId, userId),
  });
  if (existing) return existing;

  // Reuse whatever sponsor was already recorded at signup
  // (services/auth/register.ts's optional sponsorUsername) — sponsorships is
  // append-only and fixed once (see assign-sponsor.ts), so it takes
  // priority over sponsorUsername given now. Only when no sponsorship
  // exists yet does sponsorUsername apply — this lets someone who signed
  // up as a plain customer, with no sponsor on file, still name one when
  // they later decide to join the program.
  const recordedSponsorship = await tx.query.sponsorships.findFirst({
    where: eq(sponsorships.userId, userId),
  });

  let sponsorId: string | null = recordedSponsorship?.sponsorId ?? null;
  if (!sponsorId && input.sponsorUsername) {
    // tx, not the repositories/profiles.ts helper (hardcoded to the
    // top-level db): this whole function now runs inside a transaction —
    // reading through a second, separate connection/handle while tx is
    // open self-deadlocked against pglite's single embedded connection
    // (caught by the local level-2 simulation timing out).
    const sponsorProfile = await tx.query.profiles.findFirst({
      where: eq(profiles.username, input.sponsorUsername),
    });
    if (!sponsorProfile) {
      throw new Error("Aucun membre ne correspond à ce pseudo de parrain.");
    }
    if (sponsorProfile.id === userId) {
      throw new Error("Vous ne pouvez pas être votre propre parrain.");
    }
    sponsorId = sponsorProfile.id;
  }

  if (sponsorId) {
    const sponsorAmbassador = await tx.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, sponsorId),
    });
    if (!sponsorAmbassador || sponsorAmbassador.status !== "ACTIVE") {
      throw new Error(
        "Ce parrain doit être un ambassadeur actif pour vous accueillir dans son équipe.",
      );
    }
  }

  if (sponsorId) {
    await assignSponsor(tx, userId, sponsorId);
  }

  // The idempotency guard for real: the check above is a convenience
  // early-exit, this is what protects against a concurrent double call.
  const [ambassador] = await tx
    .insert(ambassadorProfiles)
    .values({
      userId,
      referralCode: profile.username,
      // Recorded at the moment this actually runs (payment confirmation,
      // usually), not when the registration form's checkbox was ticked —
      // consent was given then, but confirm-subscription-payment.ts is
      // what acts on it, potentially minutes or days later.
      termsAcceptedAt: new Date(),
      termsVersion: input.termsVersion,
    })
    .onConflictDoNothing({ target: ambassadorProfiles.userId })
    .returning();

  if (!ambassador) {
    return tx.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, userId),
    });
  }

  if (sponsorId) {
    await placeMember(tx, userId, sponsorId);
  } else {
    // No sponsor only ever happens for the platform's very first
    // ambassador — createRootNode refuses a second call once a root
    // exists, same guard activate-registration.ts already relies on.
    await createRootNode(tx, userId);
  }

  await unlockLevel(tx, userId, 1);

  return ambassador;
}

// Wraps the function above in its own transaction for the standalone caller
// (dashboard/become-ambassador's own flow, for a member who's already
// ACTIVE and joining separately from paying) — confirm-subscription-
// payment.ts calls joinAmbassadorProgram directly instead, passing its own
// existing tx.
export async function joinAmbassadorProgramInNewTransaction(
  userId: string,
  input: { sponsorUsername?: string; termsVersion: string },
) {
  return db.transaction((tx) => joinAmbassadorProgram(tx, userId, input));
}
