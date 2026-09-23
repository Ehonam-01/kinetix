import "server-only";
import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { mentorReviews, mentorships } from "@/db/schema/mentorships";
import { profiles } from "@/db/schema/profiles";

export function findMentorshipForPair(
  executor: Executor,
  mentorUserId: string,
  menteeUserId: string,
) {
  return executor.query.mentorships.findFirst({
    where: and(
      eq(mentorships.mentorUserId, mentorUserId),
      eq(mentorships.menteeUserId, menteeUserId),
    ),
  });
}

// dashboard/mentors renders one card per approved mentor and needs the
// viewer's own relationship (if any) with each — one query for the whole
// page instead of one per card.
export async function listMentorshipsForMentee(
  executor: Executor,
  menteeUserId: string,
) {
  const rows = await executor.query.mentorships.findMany({
    where: eq(mentorships.menteeUserId, menteeUserId),
  });
  return new Map(rows.map((row) => [row.mentorUserId, row]));
}

export type PendingMentorshipRequest = {
  id: string;
  menteeUserId: string;
  menteeUsername: string;
  menteeFullName: string;
  requestedAt: Date;
};

// become-mentor's incoming-requests list for an APPROVED mentor — oldest
// first, same "nothing gets buried" convention as
// listPendingMentorRequestsForAdmin.
export function listPendingMentorshipRequestsForMentor(
  executor: Executor,
  mentorUserId: string,
): Promise<PendingMentorshipRequest[]> {
  return executor
    .select({
      id: mentorships.id,
      menteeUserId: mentorships.menteeUserId,
      menteeUsername: profiles.username,
      menteeFullName: profiles.fullName,
      requestedAt: mentorships.requestedAt,
    })
    .from(mentorships)
    .innerJoin(profiles, eq(profiles.id, mentorships.menteeUserId))
    .where(
      and(
        eq(mentorships.mentorUserId, mentorUserId),
        eq(mentorships.status, "REQUESTED"),
      ),
    )
    .orderBy(desc(mentorships.requestedAt));
}

export type MentorRating = { averageRating: number | null; reviewCount: number };

// dashboard/mentors needs an average+count per card — one grouped query for
// every visible mentor instead of one per card.
export async function listMentorRatings(
  executor: Executor,
  mentorUserIds: string[],
): Promise<Map<string, MentorRating>> {
  if (mentorUserIds.length === 0) return new Map();

  const rows = await executor
    .select({
      mentorUserId: mentorReviews.mentorUserId,
      averageRating: avg(mentorReviews.rating),
      reviewCount: count(mentorReviews.id),
    })
    .from(mentorReviews)
    .where(inArray(mentorReviews.mentorUserId, mentorUserIds))
    .groupBy(mentorReviews.mentorUserId);

  return new Map(
    rows.map((row) => [
      row.mentorUserId,
      {
        averageRating: row.averageRating !== null ? Number(row.averageRating) : null,
        reviewCount: Number(row.reviewCount),
      },
    ]),
  );
}

export type MentorReviewWithMentee = {
  id: string;
  mentorshipId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  menteeUsername: string;
  menteeFullName: string;
};

// Most recent first, everywhere a mentor's reviews are shown (directory
// card preview, become-mentor's own "avis reçus" section) — limit is set
// by the caller since the two contexts want a different amount.
export function listMentorReviews(
  executor: Executor,
  mentorUserId: string,
  limit?: number,
): Promise<MentorReviewWithMentee[]> {
  const query = executor
    .select({
      id: mentorReviews.id,
      mentorshipId: mentorReviews.mentorshipId,
      rating: mentorReviews.rating,
      comment: mentorReviews.comment,
      createdAt: mentorReviews.createdAt,
      menteeUsername: profiles.username,
      menteeFullName: profiles.fullName,
    })
    .from(mentorReviews)
    .innerJoin(profiles, eq(profiles.id, mentorReviews.menteeUserId))
    .where(eq(mentorReviews.mentorUserId, mentorUserId))
    .orderBy(desc(mentorReviews.createdAt));

  return limit ? query.limit(limit) : query;
}

// dashboard/mentors needs to know, per card, whether the viewer already
// left a review for that mentorship (to prefill the form as an edit) —
// keyed by mentorshipId since that's what the review form looks up with,
// one query for every mentorship the mentee has instead of one per card.
export async function listMenteeReviewsByMentorship(
  executor: Executor,
  menteeUserId: string,
) {
  const rows = await executor.query.mentorReviews.findMany({
    where: eq(mentorReviews.menteeUserId, menteeUserId),
  });
  return new Map(rows.map((row) => [row.mentorshipId, row]));
}
