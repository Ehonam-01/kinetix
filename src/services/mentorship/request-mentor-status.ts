import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorProfiles } from "@/db/schema/mentor-profiles";
import { findMentorProfileByUserId } from "@/repositories/mentors";

// A member's request to be listed as a mentor in one domain — mirrors the
// admin-review shape of request-withdrawal.ts/request-account-deletion.ts
// but with no OTP: no money and no destructive account change is at stake,
// only a directory listing an admin still has to approve before it's ever
// visible to anyone else (dashboard/mentors).
//
// PENDING_REVIEW and APPROVED both block a new request outright — resubmit
// only exists for REJECTED, which resets the row (new category/pitch,
// status back to PENDING_REVIEW, review trail cleared) rather than
// inserting a second row, since userId is unique on mentor_profiles.
export async function requestMentorStatus(
  userId: string,
  category: string,
  pitch: string | undefined,
) {
  const trimmedCategory = category.trim();
  if (!trimmedCategory) {
    throw new Error("Choisissez un domaine.");
  }
  const trimmedPitch = pitch?.trim() || null;

  const existing = await findMentorProfileByUserId(db, userId);
  if (existing && existing.status !== "REJECTED") {
    throw new Error(
      existing.status === "APPROVED"
        ? "Vous êtes déjà mentor validé."
        : "Votre demande est déjà en cours d'examen.",
    );
  }

  if (existing) {
    const [updated] = await db
      .update(mentorProfiles)
      .set({
        category: trimmedCategory,
        pitch: trimmedPitch,
        status: "PENDING_REVIEW",
        requestedAt: sql`now()`,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      })
      .where(eq(mentorProfiles.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(mentorProfiles)
    .values({ userId, category: trimmedCategory, pitch: trimmedPitch })
    .returning();
  return created;
}
