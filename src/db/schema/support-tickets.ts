import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "OPEN",
  "ANSWERED",
  "CLOSED",
]);

// A member's support request (dashboard/support) and its conversation with
// the team (admin/support). Status follows the last message: a member's
// message makes it OPEN (waiting for the team), a team reply ANSWERED.
// category holds a value of config/support.ts.
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short human reference shown to the member and the admin (#1042).
    number: integer("number").generatedAlwaysAsIdentity({ startWith: 1001 }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    category: text("category").notNull(),
    subject: text("subject").notNull(),
    status: supportTicketStatusEnum("status").notNull().default("OPEN"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // When the member last opened the ticket — team replies after this are
    // shown as new.
    memberReadAt: timestamp("member_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("support_tickets_user_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
  ],
);

export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => profiles.id),
    // true for a reply from the team (an admin), shown as "Équipe Kinetix".
    fromStaff: boolean("from_staff").notNull().default(false),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("support_ticket_messages_ticket_idx").on(table.ticketId)],
);
