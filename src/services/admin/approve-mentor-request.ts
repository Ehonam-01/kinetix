import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorProfiles } from "@/db/schema/mentor-profiles";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "./audit-log";

// Admin-only. Mirrors approve-withdrawal.ts's shape without the external
// payout call: there's nothing to trigger outside the database, approving
// just makes the mentor visible on dashboard/mentors.
export async function approveMentorRequest(
  adminUserId: string,
  mentorProfileId: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut valider un mentor.");
    }

    const request = await tx.query.mentorProfiles.findFirst({
      where: eq(mentorProfiles.id, mentorProfileId),
    });
    if (!request) {
      throw new Error("Demande de mentorat introuvable.");
    }

    const [updated] = await tx
      .update(mentorProfiles)
      .set({
        status: "APPROVED",
        reviewedBy: adminUserId,
        reviewedAt: sql`now()`,
      })
      .where(
        and(
          eq(mentorProfiles.id, mentorProfileId),
          eq(mentorProfiles.status, "PENDING_REVIEW"),
        ),
      )
      .returning();
    if (!updated) {
      throw new Error("Cette demande n'est plus en attente de validation.");
    }

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "MENTOR_REQUEST_APPROVED",
      targetType: "mentor_profile",
      targetId: mentorProfileId,
      metadata: { userId: request.userId, category: request.category },
    });

    return updated;
  });
}
