import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";
import { profiles } from "@/db/schema/profiles";
import { escapeHtml } from "@/lib/escape-html";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import {
  GRACE_REMINDER_ACTION,
  getSubscriptionStatus,
} from "@/repositories/subscriptions";
import { logAdminAction } from "@/services/admin/audit-log";
import { resendEmailProvider } from "@/services/notifications/resend-email";

// A second reminder to the same member within this window is refused — a
// double click, or "Relancer tous" right after a single one.
const MIN_HOURS_BETWEEN_REMINDERS = 1;

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { dateStyle: "long" });
}

// Admin-triggered reminder to a member in their grace period: the date
// their account will be deactivated, and that commissions stop then (they
// keep earning until that date — services/mlm/commission.ts). Logged in
// audit_logs, which is also where "dernière relance" is read from.
export async function sendGraceReminder(adminUserId: string, userId: string) {
  const admin = await db.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut relancer un membre.");
  }

  const status = await getSubscriptionStatus(db, userId);
  if (
    !status.inGracePeriod ||
    !status.expiresAt ||
    !status.graceEndsAt ||
    status.graceDaysLeft == null
  ) {
    throw new Error("Ce membre n'est pas en période de grâce.");
  }

  const recent = await db.query.auditLogs.findFirst({
    where: and(
      eq(auditLogs.action, GRACE_REMINDER_ACTION),
      eq(auditLogs.targetId, userId),
      gt(
        auditLogs.createdAt,
        sql`now() - make_interval(hours => ${MIN_HOURS_BETWEEN_REMINDERS})`,
      ),
    ),
  });
  if (recent) {
    throw new Error("Ce membre a déjà été relancé il y a moins d'une heure.");
  }

  const [member, email] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    findAuthEmailByUserId(db, userId),
  ]);
  if (!member || !email) {
    throw new Error("Impossible de retrouver l'adresse email de ce membre.");
  }

  const days = status.graceDaysLeft;
  const deadline = formatDate(status.graceEndsAt);
  const renewUrl = `${getSiteEnv().SITE_URL}/dashboard/subscription`;
  const lines = [
    `Bonjour ${escapeHtml(member.fullName)},`,
    `Votre abonnement Kinetix Africa a expiré le ${formatDate(status.expiresAt)}. ${
      days <= 1
        ? "Il vous reste moins d'un jour"
        : `Il vous reste ${days} jours`
    } pour le renouveler, jusqu'au <strong>${deadline}</strong>.`,
    "D'ici là, vous gardez l'accès à vos formations et vous continuez de toucher vos commissions. Passé cette date, votre compte sera désactivé et les commissions qui vous reviendraient seront définitivement perdues.",
  ];

  await resendEmailProvider.sendEmail({
    to: email,
    subject: `Votre compte sera désactivé le ${deadline}`,
    html: `
      ${lines.map((line) => `<p>${line}</p>`).join("\n")}
      <p><a href="${renewUrl}">Renouveler mon abonnement</a></p>
    `,
    text: [
      ...lines.map((line) => line.replace(/<[^>]+>/g, "")),
      `Renouveler mon abonnement : ${renewUrl}`,
    ].join("\n\n"),
  });

  await logAdminAction(db, {
    actorUserId: adminUserId,
    action: GRACE_REMINDER_ACTION,
    targetType: "profile",
    targetId: userId,
    metadata: { graceEndsAt: status.graceEndsAt.toISOString() },
  });
}
