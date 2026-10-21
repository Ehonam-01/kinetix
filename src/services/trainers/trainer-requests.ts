import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { trainerProfiles } from "@/db/schema/trainer-profiles";
import { escapeHtml } from "@/lib/escape-html";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import {
  trainerRequestSchema,
  type TrainerRequestInput,
} from "@/schemas/trainer";
import { logAdminAction } from "@/services/admin/audit-log";
import { assertMaxLength, LONG_TEXT_MAX } from "@/services/admin/input-limits";
import { alertAdmins } from "@/services/notifications/admin-alerts";
import { resendEmailProvider } from "@/services/notifications/resend-email";

// Becoming a trainer (dashboard/become-trainer, admin/trainers): the same
// review shape as becoming a mentor (services/mentorship/
// request-mentor-status.ts, services/admin/*-mentor-request.ts). The member
// applies with the course they'd teach; an admin approves or refuses (with
// a reason); a refused member can apply again, which resets the same row.
// The member is emailed the decision; the admins are told of each new
// application.

export async function findTrainerProfileByUserId(userId: string) {
  return (
    (await db.query.trainerProfiles.findFirst({
      where: eq(trainerProfiles.userId, userId),
    })) ?? null
  );
}

export async function requestTrainerStatus(
  userId: string,
  input: TrainerRequestInput,
) {
  const data = trainerRequestSchema.parse(input);
  const values = {
    domain: data.domain,
    courseTitle: data.courseTitle,
    courseOutline: data.courseOutline,
    experience: data.experience,
    sampleUrl: data.sampleUrl || null,
  };

  const existing = await findTrainerProfileByUserId(userId);
  if (existing && existing.status !== "REJECTED") {
    throw new Error(
      existing.status === "APPROVED"
        ? "Vous êtes déjà formateur validé."
        : "Votre candidature est déjà en cours d'examen.",
    );
  }

  let saved;
  if (existing) {
    [saved] = await db
      .update(trainerProfiles)
      .set({
        ...values,
        status: "PENDING_REVIEW",
        requestedAt: sql`now()`,
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      })
      .where(
        and(
          eq(trainerProfiles.id, existing.id),
          eq(trainerProfiles.status, "REJECTED"),
        ),
      )
      .returning();
  } else {
    [saved] = await db
      .insert(trainerProfiles)
      .values({ userId, ...values })
      .onConflictDoNothing({ target: trainerProfiles.userId })
      .returning();
  }
  if (!saved) {
    throw new Error("Votre candidature est déjà en cours d'examen.");
  }

  const member = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  alertAdmins(
    `trainer-request:${saved.id}`,
    "Nouvelle candidature de formateur",
    [
      `${member?.fullName ?? "Un membre"} (${member?.username ?? "?"}) propose la formation « ${data.courseTitle} » (${data.domain}).`,
      `À examiner : ${getSiteEnv().SITE_URL}/admin/trainers`,
    ],
  );
  return saved;
}

// ----------------------------------------------------------------- admin

export async function listTrainerRequestsForAdmin() {
  const rows = await db
    .select({
      request: trainerProfiles,
      fullName: profiles.fullName,
      username: profiles.username,
      phone: profiles.phone,
    })
    .from(trainerProfiles)
    .innerJoin(profiles, eq(profiles.id, trainerProfiles.userId))
    .orderBy(desc(trainerProfiles.requestedAt));
  return {
    pending: rows
      .filter((r) => r.request.status === "PENDING_REVIEW")
      .reverse(),
    approved: rows.filter((r) => r.request.status === "APPROVED"),
  };
}

async function decide(
  adminUserId: string,
  trainerProfileId: string,
  decision: { status: "APPROVED" } | { status: "REJECTED"; reason: string },
) {
  const updated = await db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut examiner une candidature.");
    }
    const [row] = await tx
      .update(trainerProfiles)
      .set({
        status: decision.status,
        reviewedBy: adminUserId,
        reviewedAt: sql`now()`,
        rejectionReason:
          decision.status === "REJECTED" ? decision.reason : null,
      })
      .where(
        and(
          eq(trainerProfiles.id, trainerProfileId),
          eq(trainerProfiles.status, "PENDING_REVIEW"),
        ),
      )
      .returning();
    if (!row) {
      throw new Error("Cette candidature n'est plus en attente d'examen.");
    }
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action:
        decision.status === "APPROVED"
          ? "TRAINER_REQUEST_APPROVED"
          : "TRAINER_REQUEST_REJECTED",
      targetType: "trainer_profile",
      targetId: row.id,
      metadata: { userId: row.userId, courseTitle: row.courseTitle },
    });
    return row;
  });
  scheduleDecisionEmail(updated.id);
  return updated;
}

export function approveTrainerRequest(
  adminUserId: string,
  trainerProfileId: string,
) {
  return decide(adminUserId, trainerProfileId, { status: "APPROVED" });
}

export function rejectTrainerRequest(
  adminUserId: string,
  trainerProfileId: string,
  reason: string,
) {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Un motif de refus est requis.");
  assertMaxLength(trimmed, LONG_TEXT_MAX, "Motif de refus");
  return decide(adminUserId, trainerProfileId, {
    status: "REJECTED",
    reason: trimmed,
  });
}

// ---------------------------------------------------------------- email

// The decision, to the member. Best-effort, after the response; the page
// shows it anyway.
export async function sendTrainerDecisionEmail(trainerProfileId: string) {
  try {
    const [row] = await db
      .select({ request: trainerProfiles, fullName: profiles.fullName })
      .from(trainerProfiles)
      .innerJoin(profiles, eq(profiles.id, trainerProfiles.userId))
      .where(eq(trainerProfiles.id, trainerProfileId));
    if (!row || row.request.status === "PENDING_REVIEW") return;
    const to = await findAuthEmailByUserId(db, row.request.userId);
    if (!to) return;

    const firstName = row.fullName.trim().split(/\s+/)[0] ?? "";
    const approved = row.request.status === "APPROVED";
    const title = row.request.courseTitle;
    const lines = approved
      ? [
          `Bonjour ${firstName},`,
          `Bonne nouvelle : ta candidature de formateur est acceptée pour la formation « ${title} ».`,
          "L'équipe Kinetix Africa te contacte très vite sur WhatsApp pour préparer la formation avec toi : programme, enregistrement des leçons et mise en ligne.",
        ]
      : [
          `Bonjour ${firstName},`,
          `Ta candidature de formateur pour « ${title} » n'a pas été retenue pour le moment.`,
          `Motif : ${row.request.rejectionReason ?? "—"}`,
          "Tu peux en déposer une nouvelle depuis ton espace, en tenant compte de ce retour.",
        ];
    const url = `${getSiteEnv().SITE_URL}/dashboard/become-trainer`;
    await resendEmailProvider.sendEmail({
      to,
      subject: approved
        ? "Ta candidature de formateur est acceptée"
        : "Ta candidature de formateur",
      html: `
        ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n")}
        <p><a href="${url}">Voir ma candidature</a></p>
        <p>L'équipe Kinetix Africa</p>
      `,
      text: [...lines, `Voir ma candidature : ${url}`].join("\n\n"),
    });
  } catch (err) {
    console.error("Email de décision formateur non envoyé :", err);
  }
}

function scheduleDecisionEmail(trainerProfileId: string) {
  try {
    after(() => sendTrainerDecisionEmail(trainerProfileId));
  } catch {
    // Outside a request (scripts, tests): no email.
  }
}
