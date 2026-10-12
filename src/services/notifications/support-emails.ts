import "server-only";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import {
  supportTicketMessages,
  supportTickets,
} from "@/db/schema/support-tickets";
import { escapeHtml } from "@/lib/escape-html";
import {
  findAuthEmailByUserId,
  listAuthEmails,
} from "@/repositories/auth-users";
import { resendEmailProvider } from "./resend-email";

// Support ticket emails are a convenience on top of the site, where every
// message stays readable: best-effort, sent after the response (after()),
// never retried, never thrown.

async function loadTicket(ticketId: string) {
  const [row] = await db
    .select({
      ticket: supportTickets,
      fullName: profiles.fullName,
      username: profiles.username,
      status: profiles.status,
    })
    .from(supportTickets)
    .innerJoin(profiles, eq(profiles.id, supportTickets.userId))
    .where(eq(supportTickets.id, ticketId));
  return row ?? null;
}

async function lastMessage(ticketId: string) {
  const messages = await db
    .select()
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.ticketId, ticketId));
  return messages.sort((a, b) => +b.createdAt - +a.createdAt)[0] ?? null;
}

const paragraphs = (text: string) =>
  escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
    .join("\n");

// To every admin: a new ticket, or a member's new message on one.
export async function sendStaffTicketEmail(
  ticketId: string,
  kind: "NEW" | "REPLY",
) {
  try {
    const row = await loadTicket(ticketId);
    const message = await lastMessage(ticketId);
    if (!row || !message) return;
    const admins = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, "ADMIN"));
    const emails = (
      await listAuthEmails(
        db,
        admins.map((a) => a.id),
      )
    )
      .map((a) => a.email)
      .filter((e): e is string => !!e);
    if (emails.length === 0) return;

    const url = `${getSiteEnv().SITE_URL}/admin/support/${ticketId}`;
    const who = `${row.fullName} (${row.username})`;
    const subject =
      kind === "NEW"
        ? `Nouveau ticket #${row.ticket.number} : ${row.ticket.subject}`
        : `Ticket #${row.ticket.number} : nouveau message de ${row.fullName}`;
    for (const to of emails) {
      await resendEmailProvider.sendEmail({
        to,
        subject,
        html: `
        <p><strong>${escapeHtml(who)}</strong> ${
          kind === "NEW" ? "a ouvert un ticket" : "a répondu sur le ticket"
        } <strong>#${row.ticket.number} · ${escapeHtml(row.ticket.subject)}</strong>.</p>
        ${paragraphs(message.body)}
        <p><a href="${url}">Répondre dans l'espace admin</a></p>
      `,
        text: [
          `${who} ${kind === "NEW" ? "a ouvert un ticket" : "a répondu sur le ticket"} #${row.ticket.number} · ${row.ticket.subject}.`,
          message.body,
          `Répondre : ${url}`,
        ].join("\n\n"),
      });
    }
  } catch (err) {
    console.error(
      `Email support (admin) non envoyé, ticket ${ticketId} :`,
      err,
    );
  }
}

// To the member: the team answered their ticket.
export async function sendMemberReplyEmail(ticketId: string) {
  try {
    const row = await loadTicket(ticketId);
    const message = await lastMessage(ticketId);
    if (!row || !message?.fromStaff || row.status === "DELETED") return;
    const to = await findAuthEmailByUserId(db, row.ticket.userId);
    if (!to) return;

    const url = `${getSiteEnv().SITE_URL}/dashboard/support/${ticketId}`;
    const firstName = row.fullName.trim().split(/\s+/)[0] ?? "";
    const closed = row.ticket.status === "CLOSED";
    await resendEmailProvider.sendEmail({
      to,
      subject: `Réponse à ton ticket #${row.ticket.number} : ${row.ticket.subject}`,
      html: `
        <p>Bonjour ${escapeHtml(firstName)},</p>
        <p>L'équipe Kinetix Africa a répondu à ton ticket <strong>#${row.ticket.number} · ${escapeHtml(row.ticket.subject)}</strong> :</p>
        <blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px">${paragraphs(message.body)}</blockquote>
        <p>${
          closed
            ? "Le ticket est maintenant fermé. Tu peux le rouvrir en y répondant si besoin."
            : "Tu peux répondre directement depuis ton espace."
        }</p>
        <p><a href="${url}">Voir mon ticket</a></p>
      `,
      text: [
        `Bonjour ${firstName},`,
        `L'équipe Kinetix Africa a répondu à ton ticket #${row.ticket.number} · ${row.ticket.subject} :`,
        message.body,
        closed
          ? "Le ticket est maintenant fermé. Tu peux le rouvrir en y répondant si besoin."
          : "Tu peux répondre directement depuis ton espace.",
        `Voir mon ticket : ${url}`,
      ].join("\n\n"),
    });
  } catch (err) {
    console.error(
      `Email support (membre) non envoyé, ticket ${ticketId} :`,
      err,
    );
  }
}

function schedule(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    // Outside a request (scripts, tests): no email.
  }
}

export function scheduleStaffTicketEmail(
  ticketId: string,
  kind: "NEW" | "REPLY",
) {
  schedule(() => sendStaffTicketEmail(ticketId, kind));
}

export function scheduleMemberReplyEmail(ticketId: string) {
  schedule(() => sendMemberReplyEmail(ticketId));
}
