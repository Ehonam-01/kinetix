import "server-only";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { escapeHtml } from "@/lib/escape-html";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { getBalance } from "@/repositories/financial-transactions";
import { resendEmailProvider } from "./resend-email";

// At most this many emails per run; the rest goes out on the next one.
const BATCH_SIZE = 50;

type ClaimedCommission = {
  id: string;
  beneficiary_user_id: string;
  amount: number;
  beneficiary_name: string;
  beneficiary_status: string;
  referral_name: string | null;
  referral_username: string | null;
};

const fmt = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;

function buildEmail(c: ClaimedCommission, availableBalance: number) {
  const firstName = escapeHtml(c.beneficiary_name.trim().split(/\s+/)[0] ?? "");
  const referral = c.referral_name
    ? `<strong>${escapeHtml(c.referral_name)}</strong>${
        c.referral_username ? ` (${escapeHtml(c.referral_username)})` : ""
      }`
    : "une nouvelle personne";
  return {
    subject: `Félicitations : +${fmt(c.amount)} pour ton nouveau filleul`,
    lines: [
      `Félicitations ${firstName} !`,
      `${referral} vient de rejoindre Kinetix Africa grâce à toi : son abonnement est confirmé.`,
      `Ta commission de parrainage de <strong>${fmt(c.amount)}</strong> a été ajoutée à ton solde.`,
      `Solde disponible : <strong>${fmt(availableBalance)}</strong>. Tu peux le retirer vers mobile money depuis ton espace, ou l'utiliser pour payer un abonnement.`,
      "Continue à partager ton lien : chaque nouvelle inscription te rapporte une commission.",
    ],
  };
}

function toPlainText(line: string) {
  return line
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Emails each sponsor whose direct referral commission (DIRECT_SALE) hasn't
// been announced yet: congratulations, who joined, the amount, and the
// balance now available. Same delivery rules as the level emails
// (level-completed-emails.ts): each row is claimed first (FOR UPDATE SKIP
// LOCKED) so it's sent once; a failed send is released for the next run;
// never throws.
export async function sendCommissionEmails(): Promise<{
  sent: number;
  failed: number;
}> {
  let sent = 0;
  let failed = 0;
  try {
    const claimed = await db.execute<ClaimedCommission>(sql`
      UPDATE commission_events ce
      SET notified_at = now()
      FROM profiles b
      WHERE ce.id IN (
          SELECT id FROM commission_events
          WHERE type = 'DIRECT_SALE' AND notified_at IS NULL
          ORDER BY created_at
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        AND b.id = ce.beneficiary_user_id
      RETURNING ce.id, ce.beneficiary_user_id, ce.amount,
        b.full_name AS beneficiary_name, b.status AS beneficiary_status,
        (SELECT full_name FROM profiles WHERE id = ce.source_user_id) AS referral_name,
        (SELECT username FROM profiles WHERE id = ce.source_user_id) AS referral_username
    `);
    if (claimed.length === 0) return { sent, failed };

    const commissionsUrl = `${getSiteEnv().SITE_URL}/dashboard/commissions`;
    for (const commission of claimed) {
      if (commission.beneficiary_status === "DELETED") continue;
      try {
        const to = await findAuthEmailByUserId(
          db,
          commission.beneficiary_user_id,
        );
        if (!to) continue;
        const balance = await getBalance(db, commission.beneficiary_user_id);
        const { subject, lines } = buildEmail(
          commission,
          balance.availableBalance,
        );
        await resendEmailProvider.sendEmail({
          to,
          subject,
          html: `
            ${lines.map((line) => `<p>${line}</p>`).join("\n")}
            <p><a href="${commissionsUrl}">Voir mes commissions</a></p>
          `,
          text: [
            ...lines.map(toPlainText),
            `Voir mes commissions : ${commissionsUrl}`,
          ].join("\n\n"),
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `Email de commission non envoyé (commission_events ${commission.id}) :`,
          err,
        );
        await db
          .execute(
            sql`UPDATE commission_events SET notified_at = NULL WHERE id = ${commission.id}`,
          )
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error("Envoi des emails de commission impossible :", err);
  }
  return { sent, failed };
}

// Called by services/mlm/commission.ts when a direct referral commission is
// recorded — inside a transaction not yet committed, so the email waits for
// the response (after()). Outside a request, the daily cron sends it.
export function scheduleCommissionEmails() {
  try {
    after(sendCommissionEmails);
  } catch {
    // Not in a request: left to the daily cron.
  }
}
