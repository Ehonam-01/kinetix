import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mentorProfiles } from "@/db/schema/mentor-profiles";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "./audit-log";

// Admin-only. Mirrors reject-withdrawal.ts's shape — a required reason,
// stamped reviewedBy/reviewedAt. Leaves the row in place (REJECTED) rather
// than deleting it, same "never invent a status by silently removing the
// record" convention as every other request table in this app — the member
// can resubmit (services/mentorship/request-mentor-status.ts), which resets
// this exact row rather than creating a second one.
export async function rejectMentorRequest(
  adminUserId: string,
  mentorProfileId: string,
  reason: string,
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Un motif de refus est requis.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut refuser un mentor.");
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
        status: "REJECTED",
        reviewedBy: adminUserId,
        reviewedAt: sql`now()`,
        rejectionReason: trimmedReason,
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
      action: "MENTOR_REQUEST_REJECTED",
      targetType: "mentor_profile",
      targetId: mentorProfileId,
      metadata: {
        userId: request.userId,
        category: request.category,
        reason: trimmedReason,
      },
    });

    return updated;
  });
}
