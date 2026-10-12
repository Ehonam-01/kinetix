import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { installmentPlans } from "@/db/schema/installment-plans";
import { launchOfferReminders } from "@/db/schema/launch-offer-reminders";
import { profiles } from "@/db/schema/profiles";
import { escapeHtml } from "@/lib/escape-html";
import { listAuthEmails } from "@/repositories/auth-users";
import {
  getLaunchOffer,
  lastLaunchDayLabel,
} from "@/services/pricing/launch-offer";
import { resendEmailProvider } from "./resend-email";

const DAY_MS = 24 * 60 * 60 * 1000;
export const REMINDER_STAGES = [7, 3, 1] as const;
const BATCH_SIZE = 200;

// Which reminder is due: the smallest stage covering the days left
// (counting today). The daily cron runs at 08:00 GMT, so for an end at
// midnight GMT: 7 days before, 3 days before, and the last day. A missed
// run only ever sends the current stage, never a backlog.
export function reminderStage(endsAt: Date, now: Date): number | null {
  const msLeft = endsAt.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  return REMINDER_STAGES.filter((s) => daysLeft <= s).at(-1) ?? null;
}

type Audience = "PENDING" | "AMBASSADOR";

const fmt = (n: number) => `${n.toLocaleString("fr-FR")} F`;

function when(stage: number) {
  return stage === 1 ? "Dernier jour" : `Plus que ${stage} jours`;
}

function buildEmail(
  audience: Audience,
  stage: number,
  firstName: string,
  offer: { price: number; nextPrice: number; lastDay: string },
) {
  const site = getSiteEnv().SITE_URL;
  const saving = fmt(offer.nextPrice - offer.price);
  if (audience === "PENDING") {
    return {
      subject: `${when(stage)} : rejoins Kinetix Africa à ${fmt(offer.price)} au lieu de ${fmt(offer.nextPrice)}`,
      lines: [
        `Bonjour ${firstName},`,
        `Ton compte Kinetix Africa est créé, mais ton abonnement n'est pas encore activé.`,
        `Le prix de lancement de <strong>${fmt(offer.price)}</strong> par an est valable jusqu'au <strong>${offer.lastDay}</strong> inclus. Ensuite, l'abonnement passe à <strong>${fmt(offer.nextPrice)}</strong> : en t'abonnant maintenant, tu économises ${saving}.`,
        `Tu ne peux pas tout payer d'un coup ? Choisis « En plusieurs fois » et fais ton premier versement avant cette date : ta cagnotte garde le prix de ${fmt(offer.price)}, et tu as 3 mois pour la compléter.`,
      ],
      cta: {
        label: "Activer mon abonnement",
        url: `${site}/dashboard/subscription`,
      },
    };
  }
  return {
    subject: `${when(stage)} au prix de lancement : préviens tes contacts`,
    lines: [
      `Bonjour ${firstName},`,
      `Le prix de lancement de Kinetix Africa (<strong>${fmt(offer.price)}</strong> par an) se termine le <strong>${offer.lastDay}</strong>. Ensuite, l'abonnement passe à <strong>${fmt(offer.nextPrice)}</strong>.`,
      `C'est le bon moment pour en parler aux personnes que la plateforme peut aider : celles qui s'inscrivent avant cette date économisent ${saving}.`,
      `Ton lien de parrainage est dans ton espace, prêt à être copié et partagé.`,
    ],
    cta: {
      label: "Copier mon lien de parrainage",
      url: `${site}/dashboard/commissions`,
    },
  };
}

function toPlainText(line: string) {
  return line.replace(/<[^>]+>/g, "");
}

// Recipients: members registered but never paid (minus those with a
// cagnotte already open: their price is locked), and active ambassadors.
async function listRecipients() {
  const pending = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(
      and(
        eq(profiles.status, "PENDING_PAYMENT"),
        eq(profiles.role, "USER"),
        sql`NOT EXISTS (SELECT 1 FROM ${installmentPlans} ip WHERE ip.user_id = ${profiles.id} AND ip.status = 'OPEN')`,
      ),
    );
  const ambassadors = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(ambassadorProfiles)
    .innerJoin(profiles, eq(profiles.id, ambassadorProfiles.userId))
    .where(
      and(
        eq(ambassadorProfiles.status, "ACTIVE"),
        eq(profiles.status, "ACTIVE"),
      ),
    );
  return [
    ...pending.map((p) => ({ ...p, audience: "PENDING" as const })),
    ...ambassadors.map((p) => ({ ...p, audience: "AMBASSADOR" as const })),
  ];
}

// Daily (api/cron/subscription-reminders): while an end date for the launch
// price is programmed, the reminder of the day, once per person and stage
// (launch_offer_reminders). A failed send is released for the next run.
// Never throws.
export async function sendLaunchOfferReminders(now = new Date()): Promise<{
  stage: number | null;
  sent: number;
  failed: number;
}> {
  let sent = 0;
  let failed = 0;
  let stage: number | null = null;
  try {
    const offer = await getLaunchOffer(db);
    if (!offer.endsAt || !offer.nextPrice) return { stage, sent, failed };
    const deadline = new Date(offer.endsAt);
    stage = reminderStage(deadline, now);
    if (stage === null) return { stage, sent, failed };
    const details = {
      price: offer.price,
      nextPrice: offer.nextPrice,
      lastDay: lastLaunchDayLabel(offer.endsAt),
    };

    const recipients = (await listRecipients()).slice(0, BATCH_SIZE);
    const emails = new Map(
      (
        await listAuthEmails(
          db,
          recipients.map((r) => r.id),
        )
      ).map((r) => [r.id, r.email]),
    );
    for (const recipient of recipients) {
      const to = emails.get(recipient.id);
      if (!to) continue;
      const [claimed] = await db
        .insert(launchOfferReminders)
        .values({ userId: recipient.id, deadline, daysLeft: stage })
        .onConflictDoNothing()
        .returning();
      if (!claimed) continue;
      try {
        const firstName = escapeHtml(
          recipient.fullName.trim().split(/\s+/)[0] ?? "",
        );
        const { subject, lines, cta } = buildEmail(
          recipient.audience,
          stage,
          firstName,
          details,
        );
        await resendEmailProvider.sendEmail({
          to,
          subject,
          html: `
            ${lines.map((line) => `<p>${line}</p>`).join("\n")}
            <p><a href="${cta.url}">${cta.label}</a></p>
          `,
          text: [...lines.map(toPlainText), `${cta.label} : ${cta.url}`].join(
            "\n\n",
          ),
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `Rappel fin du prix de lancement non envoyé (${recipient.id}) :`,
          err,
        );
        await db
          .delete(launchOfferReminders)
          .where(eq(launchOfferReminders.id, claimed.id))
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error("Rappels fin du prix de lancement impossibles :", err);
  }
  return { stage, sent, failed };
}
