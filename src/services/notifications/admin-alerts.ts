import "server-only";
import { after } from "next/server";

// Alerts for events nobody should have to dig the logs for (security audit
// SEC-16): a payment confirmed for another amount than charged, a deposit
// landing on an installment plan already complete, rate limiting down. Each
// one is logged, then emailed to every admin account — at most once an hour
// per key on a given server instance, so a burst doesn't flood the inbox.
// Never throws: an alert must never break the operation that raised it.
const THROTTLE_MS = 60 * 60 * 1000;
const lastSentAt = new Map<string, number>();

export function alertAdmins(key: string, subject: string, lines: string[]) {
  console.error(`[ALERTE] ${subject} —`, lines.join(" | "));

  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last !== undefined && now - last < THROTTLE_MS) return;
  lastSentAt.set(key, now);

  const send = () => sendAdminAlert(subject, lines);
  try {
    // After the response: never slows down (or waits inside) the caller,
    // which may still be in a database transaction.
    after(send);
  } catch {
    // Outside a request (scripts): sent right away.
    void send();
  }
}

async function sendAdminAlert(subject: string, lines: string[]) {
  try {
    // Loaded here, not at the top: lib/rate-limit.ts imports this module,
    // and must not pull the database and email code in on load.
    const [{ eq }, { db }, { profiles }, { listAuthEmails }, { escapeHtml }] =
      await Promise.all([
        import("drizzle-orm"),
        import("@/db/client"),
        import("@/db/schema/profiles"),
        import("@/repositories/auth-users"),
        import("@/lib/escape-html"),
      ]);
    const { resendEmailProvider } = await import("./resend-email");

    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, "ADMIN"));
    const recipients = (
      await listAuthEmails(
        db,
        admins.map((a) => a.id),
      )
    )
      .map((a) => a.email)
      .filter((e): e is string => !!e);

    for (const to of recipients) {
      await resendEmailProvider.sendEmail({
        to,
        subject: `[Kinetix · alerte] ${subject}`,
        html: `
          <p><strong>${escapeHtml(subject)}</strong></p>
          ${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("\n")}
          <p style="color:#888">Alerte automatique de la plateforme. Les détails sont aussi dans les logs Vercel.</p>
        `,
        text: [subject, ...lines].join("\n\n"),
      });
    }
  } catch (err) {
    console.error("Alerte admin non envoyée :", err);
  }
}

// A provider confirmed a payment for another amount than the one charged:
// never applied, left PENDING for an admin to look at.
export function alertAmountMismatch(input: {
  source: string;
  paymentId: string;
  expected: number;
  got: number;
}) {
  alertAdmins(
    `amount-mismatch:${input.paymentId}`,
    "Paiement confirmé pour un montant incohérent",
    [
      `Source : ${input.source}`,
      `Paiement : ${input.paymentId}`,
      `Montant attendu : ${input.expected} F, montant confirmé : ${input.got} F`,
      "Le paiement n'a pas été appliqué et reste en attente : vérifiez-le chez le fournisseur, puis rapprochez-le depuis l'espace admin.",
    ],
  );
}
