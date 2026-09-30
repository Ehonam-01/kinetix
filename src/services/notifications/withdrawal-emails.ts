import "server-only";
import { eq } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { escapeHtml } from "@/lib/escape-html";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { resendEmailProvider } from "./resend-email";

export type WithdrawalEmailKind = "RECEIVED" | "PAID" | "REJECTED";

function formatAmount(amount: number) {
  return `${amount.toLocaleString("fr-FR")} F`;
}

// The plain-text part of the email, from the same lines as the HTML one.
function toPlainText(line: string) {
  return line
    .replace(/<br \/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function buildEmail(
  kind: WithdrawalEmailKind,
  request: {
    amount: number;
    feeAmount: number;
    payoutPhone: string;
    rejectionReason: string | null;
  },
) {
  const amount = formatAmount(request.amount);
  const phone = escapeHtml(request.payoutPhone);
  // What actually reaches the member's mobile money account.
  const net = formatAmount(request.amount - request.feeAmount);
  const feeNote =
    request.feeAmount > 0
      ? ` Après ${formatAmount(request.feeAmount)} de frais de retrait, vous recevrez <strong>${net}</strong>.`
      : "";

  if (kind === "RECEIVED") {
    return {
      subject: `Demande de retrait de ${amount} reçue`,
      lines: [
        `Votre demande de retrait de <strong>${amount}</strong> vers le numéro <strong>${phone}</strong> est confirmée.${feeNote}`,
        "Elle est en cours de traitement : vous recevrez un nouvel email dès que le virement sera effectué.",
      ],
    };
  }
  if (kind === "PAID") {
    return {
      subject: `Retrait de ${amount} effectué`,
      lines: [
        `Bonne nouvelle : <strong>${net}</strong> ont été envoyés sur votre compte mobile money <strong>${phone}</strong>${
          request.feeAmount > 0
            ? ` (retrait de ${amount}, dont ${formatAmount(request.feeAmount)} de frais)`
            : ""
        }.`,
        "Le montant peut mettre quelques minutes à apparaître selon votre opérateur.",
      ],
    };
  }
  const reason = request.rejectionReason
    ? `<br />Motif : ${escapeHtml(request.rejectionReason)}`
    : "";
  return {
    subject: `Demande de retrait de ${amount} refusée`,
    lines: [
      `Votre demande de retrait de <strong>${amount}</strong> vers le numéro <strong>${phone}</strong> n'a pas été validée.${reason}`,
      `La totalité du montant, soit ${amount}, a été <strong>recréditée sur votre solde disponible</strong>, sans frais : vous pouvez faire une nouvelle demande.`,
    ],
  };
}

// Keeps the member informed of each step of a withdrawal they confirmed:
// received (OTP entered), paid (the operator confirmed the transfer),
// rejected (by an admin, money back on the balance).
//
// Called only AFTER the status change is committed, and never throws: an
// email that can't be sent (Resend down, no address) must not undo or
// block a withdrawal — it's logged instead.
export async function notifyWithdrawal(
  requestId: string,
  kind: WithdrawalEmailKind,
) {
  try {
    const request = await db.query.withdrawalRequests.findFirst({
      where: eq(withdrawalRequests.id, requestId),
    });
    if (!request) return;
    const to = await findAuthEmailByUserId(db, request.userId);
    if (!to) return;

    const { subject, lines } = buildEmail(kind, request);
    const historyUrl = `${getSiteEnv().SITE_URL}/dashboard/withdrawals`;
    await resendEmailProvider.sendEmail({
      to,
      subject,
      html: `
        ${lines.map((line) => `<p>${line}</p>`).join("\n")}
        <p><a href="${historyUrl}">Voir mes retraits</a></p>
      `,
      text: [
        ...lines.map(toPlainText),
        `Voir mes retraits : ${historyUrl}`,
      ].join("\n\n"),
    });
  } catch (err) {
    console.error(
      `Email de retrait ${kind} non envoyé (demande ${requestId}) :`,
      err,
    );
  }
}
