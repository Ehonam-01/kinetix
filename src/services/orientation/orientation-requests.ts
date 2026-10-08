import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orientationRequests } from "@/db/schema/orientation-requests";
import { profiles } from "@/db/schema/profiles";
import {
  orientationRequestSchema,
  type OrientationRequestInput,
} from "@/schemas/orientation";
import { logAdminAction } from "@/services/admin/audit-log";

export const ORIENTATION_ALREADY_PENDING =
  "Ta demande d'orientation est déjà entre les mains de l'équipe : nous te recontactons sur WhatsApp.";

// The member's latest request, whatever its status (null if none).
export async function getLatestOrientationRequest(userId: string) {
  const [latest] = await db
    .select()
    .from(orientationRequests)
    .where(eq(orientationRequests.userId, userId))
    .orderBy(desc(orientationRequests.createdAt))
    .limit(1);
  return latest ?? null;
}

// Sends the questionnaire to the team and keeps the chosen goal on the
// profile (same field as Paramètres → profil communautaire). One NEW
// request at a time — the partial unique index backs this check up.
export async function submitOrientationRequest(
  userId: string,
  input: OrientationRequestInput,
) {
  const data = orientationRequestSchema.parse(input);
  return db.transaction(async (tx) => {
    const pending = await tx.query.orientationRequests.findFirst({
      where: and(
        eq(orientationRequests.userId, userId),
        eq(orientationRequests.status, "NEW"),
      ),
    });
    if (pending) throw new Error(ORIENTATION_ALREADY_PENDING);

    const [created] = await tx
      .insert(orientationRequests)
      .values({
        userId,
        goal: data.goal,
        situation: data.situation,
        level: data.level,
        weeklyTime: data.weeklyTime,
        interests: data.interests,
        message: data.message || null,
      })
      .returning();
    await tx
      .update(profiles)
      .set({ goal: data.goal })
      .where(eq(profiles.id, userId));
    return created;
  });
}

// New requests first (oldest first, so nobody waits longest), then the
// handled ones, most recent first.
export async function listOrientationRequestsForAdmin() {
  const rows = await db
    .select({
      request: orientationRequests,
      fullName: profiles.fullName,
      username: profiles.username,
      phone: profiles.phone,
      country: profiles.country,
    })
    .from(orientationRequests)
    .innerJoin(profiles, eq(profiles.id, orientationRequests.userId))
    .orderBy(desc(orientationRequests.createdAt));
  return {
    pending: rows.filter((r) => r.request.status === "NEW").reverse(),
    handled: rows.filter((r) => r.request.status === "HANDLED"),
  };
}

export async function markOrientationRequestHandled(
  adminUserId: string,
  requestId: string,
) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut traiter une demande.");
    }
    const [request] = await tx
      .update(orientationRequests)
      .set({
        status: "HANDLED",
        handledAt: new Date(),
        handledByAdminId: adminUserId,
      })
      .where(
        and(
          eq(orientationRequests.id, requestId),
          eq(orientationRequests.status, "NEW"),
        ),
      )
      .returning();
    if (!request) throw new Error("Cette demande a déjà été traitée.");
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "ORIENTATION_REQUEST_HANDLED",
      targetType: "orientation_request",
      targetId: request.id,
      metadata: { userId: request.userId },
    });
    return request;
  });
}
