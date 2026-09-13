import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { profiles } from "@/db/schema/profiles";
import { sponsorships } from "@/db/schema/sponsorships";
import { findProfileByUsername } from "@/repositories/profiles";
import { assignSponsor } from "@/services/genealogy/assign-sponsor";
import { createRootNode, placeMember } from "@/services/genealogy/place-member";
import { unlockLevel } from "@/services/mlm/unlock-level";

// Bumped whenever the ambassador program's terms actually change — the
// caller (a future UI, not built yet) is expected to pass this explicitly
// rather than the service assuming it, so a row always records the exact
// version the member actually saw, not just "whatever was current".
export const AMBASSADOR_TERMS_VERSION = "v1";

// The free opt-in (section 13 of the master prompt): no payment, no
// payments row, deliberately independent of activate-registration.ts
// (not touched by this function, not called by it, still fully
// functional). Unlike the old registration flow, no commission is paid
// here — under the new model, the direct commission is reconceived as "on
// an eligible sale", not "on recruitment" (section 11); it will only ever
// be paid by the future course-purchase flow.
export async function joinAmbassadorProgram(
  userId: string,
  input: { sponsorUsername?: string; termsVersion: string },
) {
  const profile = await db.query.profiles.findFirst({
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

  const existing = await db.query.ambassadorProfiles.findFirst({
    where: eq(ambassadorProfiles.userId, userId),
  });
  if (existing) return existing;

  // Reuse whatever sponsor was already recorded at signup
  // (services/auth/register.ts's optional sponsorEmail) — sponsorships is
  // append-only and fixed once (see assign-sponsor.ts), so it takes
  // priority over sponsorUsername given now. Only when no sponsorship
  // exists yet does sponsorUsername apply — this lets someone who signed
  // up as a plain customer, with no sponsor on file, still name one when
  // they later decide to join the program.
  const recordedSponsorship = await db.query.sponsorships.findFirst({
    where: eq(sponsorships.userId, userId),
  });

  let sponsorId: string | null = recordedSponsorship?.sponsorId ?? null;
  if (!sponsorId && input.sponsorUsername) {
    const sponsorProfile = await findProfileByUsername(input.sponsorUsername);
    if (!sponsorProfile) {
      throw new Error("Aucun membre ne correspond à ce pseudo de parrain.");
    }
    if (sponsorProfile.id === userId) {
      throw new Error("Vous ne pouvez pas être votre propre parrain.");
    }
    sponsorId = sponsorProfile.id;
  }

  if (sponsorId) {
    const sponsorAmbassador = await db.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, sponsorId),
    });
    if (!sponsorAmbassador || sponsorAmbassador.status !== "ACTIVE") {
      throw new Error(
        "Ce parrain doit être un ambassadeur actif pour vous accueillir dans son équipe.",
      );
    }
  }

  return db.transaction(async (tx) => {
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

    // Mirrors what activate-registration.ts does on payment confirmation,
    // just without a payment: an ambassador needs profiles.status ACTIVE
    // to reach their own dashboard sub-pages today (see
    // services/admin/set-member-status.ts's comment). Reconciling what
    // PENDING_PAYMENT even means now that registration is free is a
    // separate, not-yet-made decision (see MLM_RULES.md) — this only
    // covers the one case this function itself creates.
    if (profile.status !== "ACTIVE") {
      await tx
        .update(profiles)
        .set({ status: "ACTIVE" })
        .where(eq(profiles.id, userId));
    }

    return ambassador;
  });
}
