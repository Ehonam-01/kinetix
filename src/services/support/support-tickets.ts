import "server-only";
import { and, asc, count, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import {
  supportTicketMessages,
  supportTickets,
} from "@/db/schema/support-tickets";
import { MAX_OPEN_TICKETS } from "@/config/support";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { isUuid } from "@/lib/utils";
import {
  newTicketSchema,
  ticketMessageSchema,
  type NewTicketInput,
} from "@/schemas/support";
import { logAdminAction } from "@/services/admin/audit-log";
import {
  scheduleMemberReplyEmail,
  scheduleStaffTicketEmail,
} from "@/services/notifications/support-emails";

export type SupportTicketStatus = "OPEN" | "ANSWERED" | "CLOSED";

// ---------------------------------------------------------------- member

// The member's tickets, most recently active first. hasNewReply: the team
// answered since the member last opened the ticket.
export async function listTicketsForMember(userId: string) {
  const rows = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId))
    .orderBy(desc(supportTickets.lastMessageAt));
  return rows.map((ticket) => ({
    ...ticket,
    hasNewReply:
      ticket.status === "ANSWERED" &&
      ticket.lastMessageAt > ticket.memberReadAt,
  }));
}

export async function countTicketsWithNewReply(userId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, userId),
        eq(supportTickets.status, "ANSWERED"),
        sql`${supportTickets.lastMessageAt} > ${supportTickets.memberReadAt}`,
      ),
    );
  return row?.n ?? 0;
}

async function listMessages(ticketId: string) {
  return db
    .select()
    .from(supportTicketMessages)
    .where(eq(supportTicketMessages.ticketId, ticketId))
    .orderBy(asc(supportTicketMessages.createdAt));
}

// null when the ticket doesn't exist or isn't the member's. Opening it marks
// the team's replies as read.
export async function openTicketForMember(userId: string, ticketId: string) {
  if (!isUuid(ticketId)) return null;
  const ticket = await db.query.supportTickets.findFirst({
    where: and(
      eq(supportTickets.id, ticketId),
      eq(supportTickets.userId, userId),
    ),
  });
  if (!ticket) return null;
  if (ticket.lastMessageAt > ticket.memberReadAt) {
    await db
      .update(supportTickets)
      .set({ memberReadAt: new Date() })
      .where(eq(supportTickets.id, ticket.id));
  }
  return { ticket, messages: await listMessages(ticket.id) };
}

export async function createTicket(userId: string, input: NewTicketInput) {
  const data = newTicketSchema.parse(input);
  if (await isRateLimited("supportMessage", `user:${userId}`)) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  const ticket = await db.transaction(async (tx) => {
    const [open] = await tx
      .select({ n: count() })
      .from(supportTickets)
      .where(
        and(
          eq(supportTickets.userId, userId),
          ne(supportTickets.status, "CLOSED"),
        ),
      );
    if ((open?.n ?? 0) >= MAX_OPEN_TICKETS) {
      throw new Error(
        `Tu as déjà ${MAX_OPEN_TICKETS} tickets en cours : complète l'un d'eux plutôt que d'en ouvrir un nouveau.`,
      );
    }
    const [created] = await tx
      .insert(supportTickets)
      .values({ userId, category: data.category, subject: data.subject })
      .returning();
    await tx.insert(supportTicketMessages).values({
      ticketId: created.id,
      authorUserId: userId,
      body: data.message,
    });
    return created;
  });
  scheduleStaffTicketEmail(ticket.id, "NEW");
  return ticket;
}

// A member's message: the ticket goes back to the team (OPEN), reopened if
// it was closed.
export async function addMemberMessage(
  userId: string,
  ticketId: string,
  body: string,
) {
  if (!isUuid(ticketId)) throw new Error("Ticket introuvable.");
  const message = ticketMessageSchema.parse({ body }).body;
  if (await isRateLimited("supportMessage", `user:${userId}`)) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  await db.transaction(async (tx) => {
    const now = new Date();
    const [ticket] = await tx
      .update(supportTickets)
      .set({
        status: "OPEN",
        closedAt: null,
        lastMessageAt: now,
        memberReadAt: now,
      })
      .where(
        and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)),
      )
      .returning();
    if (!ticket) throw new Error("Ticket introuvable.");
    await tx.insert(supportTicketMessages).values({
      ticketId,
      authorUserId: userId,
      body: message,
    });
  });
  scheduleStaffTicketEmail(ticketId, "REPLY");
}

export async function closeTicketByMember(userId: string, ticketId: string) {
  if (!isUuid(ticketId)) throw new Error("Ticket introuvable.");
  const [ticket] = await db
    .update(supportTickets)
    .set({ status: "CLOSED", closedAt: new Date() })
    .where(
      and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)),
    )
    .returning();
  if (!ticket) throw new Error("Ticket introuvable.");
}

// ----------------------------------------------------------------- admin

async function assertAdmin(executor: Executor, adminUserId: string) {
  const admin = await executor.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut traiter un ticket.");
  }
}

// OPEN tickets oldest first (whoever has waited longest), the others most
// recently active first.
export async function listTicketsForAdmin(status: SupportTicketStatus) {
  return db
    .select({
      ticket: supportTickets,
      fullName: profiles.fullName,
      username: profiles.username,
    })
    .from(supportTickets)
    .innerJoin(profiles, eq(profiles.id, supportTickets.userId))
    .where(eq(supportTickets.status, status))
    .orderBy(
      status === "OPEN"
        ? asc(supportTickets.lastMessageAt)
        : desc(supportTickets.lastMessageAt),
    )
    .limit(200);
}

export async function countTicketsByStatus() {
  const rows = await db
    .select({ status: supportTickets.status, n: count() })
    .from(supportTickets)
    .groupBy(supportTickets.status);
  const counts: Record<SupportTicketStatus, number> = {
    OPEN: 0,
    ANSWERED: 0,
    CLOSED: 0,
  };
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

export async function getTicketForAdmin(ticketId: string) {
  if (!isUuid(ticketId)) return null;
  const [row] = await db
    .select({
      ticket: supportTickets,
      fullName: profiles.fullName,
      username: profiles.username,
      phone: profiles.phone,
      country: profiles.country,
    })
    .from(supportTickets)
    .innerJoin(profiles, eq(profiles.id, supportTickets.userId))
    .where(eq(supportTickets.id, ticketId));
  if (!row) return null;
  return { ...row, messages: await listMessages(ticketId) };
}

// The team's reply: the ticket waits for the member (ANSWERED), or is
// closed at once with close. The member is emailed.
export async function addStaffReply(
  adminUserId: string,
  ticketId: string,
  body: string,
  { close = false }: { close?: boolean } = {},
) {
  if (!isUuid(ticketId)) throw new Error("Ticket introuvable.");
  const message = ticketMessageSchema.parse({ body }).body;
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const now = new Date();
    const [ticket] = await tx
      .update(supportTickets)
      .set({
        status: close ? "CLOSED" : "ANSWERED",
        closedAt: close ? now : null,
        lastMessageAt: now,
      })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    if (!ticket) throw new Error("Ticket introuvable.");
    await tx.insert(supportTicketMessages).values({
      ticketId,
      authorUserId: adminUserId,
      fromStaff: true,
      body: message,
    });
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SUPPORT_TICKET_REPLIED",
      targetType: "support_ticket",
      targetId: ticketId,
      metadata: { userId: ticket.userId, closed: close },
    });
  });
  scheduleMemberReplyEmail(ticketId);
}

export async function setTicketStatusByAdmin(
  adminUserId: string,
  ticketId: string,
  status: "OPEN" | "CLOSED",
) {
  if (!isUuid(ticketId)) throw new Error("Ticket introuvable.");
  await db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const [ticket] = await tx
      .update(supportTickets)
      .set({ status, closedAt: status === "CLOSED" ? new Date() : null })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    if (!ticket) throw new Error("Ticket introuvable.");
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action:
        status === "CLOSED"
          ? "SUPPORT_TICKET_CLOSED"
          : "SUPPORT_TICKET_REOPENED",
      targetType: "support_ticket",
      targetId: ticketId,
      metadata: { userId: ticket.userId },
    });
  });
}
