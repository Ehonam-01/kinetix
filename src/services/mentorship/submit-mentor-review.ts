import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorReviews, mentorships } from "@/db/schema/mentorships";

// A mentee's star rating + comment on an ACCEPTED mentorship — the gate
// that makes reviews mean something: only someone the mentor actually
// accepted can leave one, not any member browsing the directory.
// mentorshipId is unique on mentor_reviews, so a second submission for the
// same relationship updates it in place (edit, not a duplicate review).
export async function submitMentorReview(
  menteeUserId: string,
  mentorshipId: string,
  rating: number,
  comment: string | undefined,
) {
  const mentorship = await db.query.mentorships.findFirst({
    where: eq(mentorships.id, mentorshipId),
  });
  if (!mentorship || mentorship.menteeUserId !== menteeUserId) {
    throw new Error("Accompagnement introuvable.");
  }
  if (mentorship.status !== "ACCEPTED") {
    throw new Error("Cet accompagnement n'est pas encore confirmé par le mentor.");
  }

  const trimmedComment = comment?.trim() || null;

  const [review] = await db
    .insert(mentorReviews)
    .values({
      mentorshipId,
      mentorUserId: mentorship.mentorUserId,
      menteeUserId,
      rating,
      comment: trimmedComment,
    })
    .onConflictDoUpdate({
      target: mentorReviews.mentorshipId,
      set: { rating, comment: trimmedComment, updatedAt: sql`now()` },
    })
    .returning();
  return review;
}
