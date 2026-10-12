import {
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// The "fin du prix de lancement" reminders already sent
// (services/notifications/launch-offer-emails.ts): one row per member, per
// scheduled price change (deadline), per stage (7, 3 or 1 day(s) left), so
// the daily cron never sends the same one twice.
export const launchOfferReminders = pgTable(
  "launch_offer_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    daysLeft: integer("days_left").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("launch_offer_reminders_once").on(
      table.userId,
      table.deadline,
      table.daysLeft,
    ),
  ],
);
