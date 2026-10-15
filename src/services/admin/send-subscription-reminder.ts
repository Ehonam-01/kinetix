import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";
import { profiles } from "@/db/schema/profiles";
import { escapeHtml } from "@/lib/escape-html";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { getSubscriptionStatus } from "@/repositories/subscriptions";
import { logAdminAction } from "@/services/admin/audit-log";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import {
  getLaunchOffer,
  lastLaunchDayLabel,
  type LaunchOffer,
} from "@/services/pricing/launch-offer";

// An admin nudging a member to pay their subscription, from the member's
// page in the admin (admin/members/[userId]): by email (sent here) or on
// WhatsApp (a prefilled link, subscriptionReminderText). Only for a member
// who can still pay by themselves — never subscribed, or expired but within
// the grace period; a deactivated account is unlocked by an admin grant
// instead. One email a day per member at most, so it never turns into
// harassment; each one is recorded in the audit log, which is also where
// the page reads the last one from.
export const REMINDER_ACTION = "SUBSCRIPTION_REMINDER_SENT";
const MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type ReminderKind = "FIRST" | "RENEWAL";

export async function reminderKindFor(userId: string) {
  const status = await getSubscriptionStatus(db, userId);
  if (status.active || status.frozen) return null;
  return status.inGracePeriod ? ("RENEWAL" as const) : ("FIRST" as const);
}

export async function getLastSubscriptionReminder(userId: string) {
  const [last] = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, REMINDER_ACTION),
        eq(auditLogs.targetId, userId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  return last?.createdAt ?? null;
}

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} F`;

function offerLine(offer: LaunchOffer) {
  if (!offer.nextPrice || !offer.savings) {
    return `L'abonnement annuel est à ${fmt(offer.price)}.`;
  }
  const until = offer.endsAt
    ? ` jusqu'au ${lastLaunchDayLabel(offer.endsAt)}`
    : "";
  return `Le prix de lancement de ${fmt(offer.price)} par an est valable${until}, avant le passage à ${fmt(offer.nextPrice)} : tu économises ${fmt(offer.savings)} en t'abonnant maintenant.`;
}

// The same message for the email and the WhatsApp link.
export function subscriptionReminderText(
  firstName: string,
  kind: ReminderKind,
  offer: LaunchOffer,
) {
  const url = `${getSiteEnv().SITE_URL}/dashboard/subscription`;
  return [
    `Bonjour ${firstName},`,
    kind === "FIRST"
      ? "Ton compte Kinetix Africa est créé, mais ton abonnement n'est pas encore activé : tu n'as pas encore accès aux formations, au mentorat et à la communauté."
      : "Ton abonnement Kinetix Africa a expiré : renouvelle-le pour garder l'accès aux formations, au mentorat et à la communauté.",
    offerLine(offer),
    ...(kind === "FIRST"
      ? [
          "Tu peux payer par mobile money, en une fois ou en plusieurs versements.",
        ]
      : []),
    `Pour activer ton abonnement : ${url}`,
    "L'équipe Kinetix Africa",
  ];
}

export async function sendSubscriptionReminder(
  adminUserId: string,
  userId: string,
) {
  const [admin, member] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, adminUserId) }),
    db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
  ]);
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut relancer un membre.");
  }
  if (!member || member.status === "DELETED") {
    throw new Error("Membre introuvable.");
  }
  const kind = await reminderKindFor(userId);
  if (!kind) {
    throw new Error(
      "Ce membre n'a rien à payer lui-même (abonnement actif, ou compte désactivé à réactiver par un admin).",
    );
  }
  const last = await getLastSubscriptionReminder(userId);
  if (last && Date.now() - last.getTime() < MIN_INTERVAL_MS) {
    throw new Error(
      "Ce membre a déjà été relancé par email il y a moins de 24 h.",
    );
  }
  const to = await findAuthEmailByUserId(db, userId);
  if (!to) throw new Error("Aucune adresse email pour ce membre.");

  const offer = await getLaunchOffer(db);
  const firstName = member.fullName.trim().split(/\s+/)[0] ?? "";
  const lines = subscriptionReminderText(firstName, kind, offer);
  const url = `${getSiteEnv().SITE_URL}/dashboard/subscription`;

  await resendEmailProvider.sendEmail({
    to,
    subject:
      kind === "FIRST"
        ? "Active ton abonnement Kinetix Africa"
        : "Ton abonnement Kinetix Africa a expiré",
    html: `
      ${lines
        .slice(0, -2)
        .map((l) => `<p>${escapeHtml(l)}</p>`)
        .join("\n")}
      <p><a href="${url}">Activer mon abonnement</a></p>
      <p>L'équipe Kinetix Africa</p>
    `,
    text: lines.join("\n\n"),
  });

  await logAdminAction(db, {
    actorUserId: adminUserId,
    action: REMINDER_ACTION,
    targetType: "profile",
    targetId: userId,
    metadata: { kind, channel: "EMAIL" },
  });
}
