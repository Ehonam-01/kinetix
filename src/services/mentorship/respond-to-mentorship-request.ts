import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorships } from "@/db/schema/mentorships";

// The mentor's own accept/decline of a mentee's request — unlike the admin
// approve/reject services this mirrors in shape, this isn't an admin action
// (no logAdminAction), since it's a member deciding about their own
// relationship, same as request-mentorship.ts and request-mentor-status.ts
// being unlogged member actions.
export async function respondToMentorshipRequest(
  mentorUserId: string,
  mentorshipId: string,
  accept: boolean,
) {
  const [updated] = await db
    .update(mentorships)
    .set({ status: accept ? "ACCEPTED" : "DECLINED", respondedAt: sql`now()` })
    .where(
      and(
        eq(mentorships.id, mentorshipId),
        eq(mentorships.mentorUserId, mentorUserId),
        eq(mentorships.status, "REQUESTED"),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Cette demande n'existe plus ou a déjà été traitée.");
  }
  return updated;
}
