import "server-only";
import { db } from "@/db/client";
import { getSiteEnv } from "@/config/env.site";
import {
  filterCurrentSubscriptions,
  findUnremindedSubscriptionsExpiringBetween,
  getLatestExpiryByUserId,
  markReminderSent,
  type ReminderKind,
} from "@/repositories/subscriptions";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { findProfileById } from "@/repositories/profiles";
import { resendEmailProvider } from "@/services/notifications/resend-email";

const DAY_MS = 24 * 60 * 60 * 1000;

const REMINDER_WINDOWS: { kind: ReminderKind; days: number }[] = [
  { kind: "reminder7d", days: 7 },
  { kind: "reminder1d", days: 1 },
];

function expiryPhrase(daysLeft: number, dateLabel: string): string {
  return `Votre abonnement annuel Kinetix Africa expire ${daysLeft === 1 ? "demain" : `dans ${daysLeft} jours`} (le ${dateLabel}).`;
}

// A plain-text alternative alongside the html — an HTML-only email is a
// real spam signal to most filters (near-universal in actual spam
// campaigns), so a multipart email scores better. Same content, same
// structure, no markup.
function emailBody(
  daysLeft: number,
  expiresAt: Date,
): { html: string; text: string } {
  const dateLabel = expiresAt.toLocaleDateString("fr-FR", {
    dateStyle: "long",
  });
  const renewUrl = `${getSiteEnv().SITE_URL}/dashboard/subscription`;
  const phrase = expiryPhrase(daysLeft, dateLabel);
  return {
    html: `
      <p>${phrase}</p>
      <p>Passé cette date, l'accès à toutes les formations sera coupé immédiatement, sans période de grâce.</p>
      <p><a href="${renewUrl}">Renouveler maintenant</a></p>
    `,
    text: [
      phrase,
      "Passé cette date, l'accès à toutes les formations sera coupé immédiatement, sans période de grâce.",
      `Renouveler maintenant : ${renewUrl}`,
    ].join("\n\n"),
  };
}

// Run by a Vercel Cron job (vercel.json, /api/cron/subscription-reminders) —
// finds every subscription entering the 7-day or 1-day reminder window since
// the last run, emails its owner once, and marks the reminder sent so a
// daily cron never double-sends. Each subscription row tracks its own two
// reminders (db/schema/subscriptions.ts) — a renewal's fresh row starts
// with both unset, so it's naturally eligible for its own reminders again.
export async function sendExpiryReminders(): Promise<{
  sent: number;
  failed: number;
}> {
  const now = new Date();
  let sent = 0;
  let failed = 0;

  for (const { kind, days } of REMINDER_WINDOWS) {
    const windowEnd = new Date(now.getTime() + days * DAY_MS);
    const candidates = await findUnremindedSubscriptionsExpiringBetween(
      db,
      kind,
      now,
      windowEnd,
    );
    if (candidates.length === 0) continue;

    const latestExpiryByUserId = await getLatestExpiryByUserId(
      db,
      candidates.map((c) => c.userId),
    );
    const due = filterCurrentSubscriptions(candidates, latestExpiryByUserId);

    for (const subscription of due) {
      try {
        const [profile, email] = await Promise.all([
          findProfileById(subscription.userId),
          findAuthEmailByUserId(db, subscription.userId),
        ]);
        if (!profile || !email) {
          throw new Error(
            `Profil ou email introuvable pour ${subscription.userId}`,
          );
        }

        const body = emailBody(days, subscription.expiresAt);
        await resendEmailProvider.sendEmail({
          to: email,
          subject:
            days === 1
              ? "Votre abonnement Kinetix Africa expire demain"
              : `Votre abonnement Kinetix Africa expire dans ${days} jours`,
          html: body.html,
          text: body.text,
        });

        await markReminderSent(db, subscription.id, kind);
        sent += 1;
      } catch (err) {
        // One member's missing email or a transient Resend error must not
        // stop the rest of the batch — same "isolate per-item failure"
        // reasoning as any other batch job, logged for visibility since
        // this runs unattended.
        console.error(
          `Rappel d'expiration ${kind} échoué pour l'abonnement ${subscription.id} :`,
          err,
        );
        failed += 1;
      }
    }
  }

  return { sent, failed };
}
