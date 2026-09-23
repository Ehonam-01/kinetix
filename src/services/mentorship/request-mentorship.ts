import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorProfiles } from "@/db/schema/mentor-profiles";
import { mentorships } from "@/db/schema/mentorships";
import { findMentorshipForPair } from "@/repositories/mentorships";

// A mentee's request to be accompanied by a specific APPROVED mentor — the
// mentor still has to accept (respond-to-mentorship-request.ts) before a
// review is ever allowed, so this alone is just a declared interest, not a
// confirmed relationship.
//
// REQUESTED and ACCEPTED both block a new request outright — re-request
// only exists after DECLINED, which resets the row (status back to
// REQUESTED) rather than inserting a second one, since mentorUserId +
// menteeUserId is unique on mentorships.
export async function requestMentorship(menteeUserId: string, mentorUserId: string) {
  if (menteeUserId === mentorUserId) {
    throw new Error("Vous ne pouvez pas demander un accompagnement à vous-même.");
  }

  const mentorProfile = await db.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, mentorUserId),
  });
  if (!mentorProfile || mentorProfile.status !== "APPROVED") {
    throw new Error("Ce mentor n'est plus disponible.");
  }

  const existing = await findMentorshipForPair(db, mentorUserId, menteeUserId);
  if (existing && existing.status !== "DECLINED") {
    throw new Error(
      existing.status === "ACCEPTED"
        ? "Vous êtes déjà accompagné par ce mentor."
        : "Votre demande est déjà en cours d'examen.",
    );
  }

  if (existing) {
    const [updated] = await db
      .update(mentorships)
      .set({ status: "REQUESTED", requestedAt: sql`now()`, respondedAt: null })
      .where(eq(mentorships.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(mentorships)
    .values({ mentorUserId, menteeUserId })
    .returning();
  return created;
}
