import "server-only";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { escapeHtml } from "@/lib/escape-html";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { getTopLevelCode } from "@/repositories/member-levels";
import { resendEmailProvider } from "./resend-email";

// At most this many emails per run: a level completion is rare (four per
// member, ever), so a run normally finds one or two. The cap only bounds
// an unusual backlog — the rest goes out on the next run.
const BATCH_SIZE = 50;

type ClaimedLevel = {
  id: string;
  user_id: string;
  level_code: number;
  level_name: string;
  full_name: string;
  profile_status: string;
};

function buildEmail(level: ClaimedLevel, isTopLevel: boolean) {
  const firstName = escapeHtml(level.full_name.trim().split(/\s+/)[0] ?? "");
  const levelLabel = `Niveau ${level.level_code} — ${escapeHtml(level.level_name)}`;
  const lines = [
    `Félicitations ${firstName} !`,
    `Vous venez de compléter le <strong>${levelLabel}</strong> du Programme Ambassadeur Kinetix Africa.`,
    isTopLevel
      ? "C'est le sommet du plan : vous obtenez le rang d'<strong>Ancêtre</strong>. Bravo pour ce parcours !"
      : `Le niveau ${level.level_code + 1} est désormais débloqué : votre progression continue.`,
    "Votre <strong>certificat de réussite</strong> est prêt : téléchargez-le depuis votre espace, page Niveaux.",
  ];
  return {
    subject: `Félicitations : niveau ${level.level_code} complété, votre certificat est prêt`,
    lines,
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

// Emails every member whose level was completed and not yet announced.
// Each row is claimed first (certificate_emailed_at set, FOR UPDATE SKIP
// LOCKED), so two runs at once — the after() below and the daily cron —
// never send the same email twice. A send that fails is released for the
// next run; a member without an address (or a deleted account) is simply
// skipped.
//
// Never throws: it runs after a level was completed and committed, and an
// email problem must not surface to whoever triggered that.
export async function sendLevelCompletedEmails(): Promise<{
  sent: number;
  failed: number;
}> {
  let sent = 0;
  let failed = 0;
  try {
    const claimed = await db.execute<ClaimedLevel>(sql`
      UPDATE member_levels ml
      SET certificate_emailed_at = now()
      FROM levels l, profiles p
      WHERE ml.id IN (
          SELECT id FROM member_levels
          WHERE status = 'COMPLETED' AND certificate_emailed_at IS NULL
          ORDER BY completed_at
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        AND l.code = ml.level_code
        AND p.id = ml.user_id
      RETURNING ml.id, ml.user_id, ml.level_code, l.name AS level_name,
        p.full_name, p.status AS profile_status
    `);
    if (claimed.length === 0) return { sent, failed };

    const topLevelCode = await getTopLevelCode(db);
    const levelsUrl = `${getSiteEnv().SITE_URL}/dashboard/levels`;

    for (const level of claimed) {
      if (level.profile_status === "DELETED") continue;
      try {
        const to = await findAuthEmailByUserId(db, level.user_id);
        if (!to) continue;
        const { subject, lines } = buildEmail(
          level,
          level.level_code >= topLevelCode,
        );
        await resendEmailProvider.sendEmail({
          to,
          subject,
          html: `
            ${lines.map((line) => `<p>${line}</p>`).join("\n")}
            <p><a href="${levelsUrl}">Télécharger mon certificat</a></p>
          `,
          text: [
            ...lines.map(toPlainText),
            `Télécharger mon certificat : ${levelsUrl}`,
          ].join("\n\n"),
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(
          `Email de niveau complété non envoyé (member_levels ${level.id}) :`,
          err,
        );
        await db
          .execute(
            sql`UPDATE member_levels SET certificate_emailed_at = NULL WHERE id = ${level.id}`,
          )
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error("Envoi des emails de niveau complété impossible :", err);
  }
  return { sent, failed };
}

// Called by services/mlm/unlock-level.ts the moment a level is completed —
// inside a transaction that isn't committed yet, so the email waits for
// the response to be sent (after()), by which time the completion is
// committed (or rolled back, and then there's nothing to send). Outside a
// request (scripts, tests) after() isn't available: the daily cron
// (/api/cron/subscription-reminders) sends it instead.
export function scheduleLevelCompletedEmails() {
  try {
    after(sendLevelCompletedEmails);
  } catch {
    // Not in a request: left to the daily cron.
  }
}
