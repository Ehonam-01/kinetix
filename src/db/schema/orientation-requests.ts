import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./profiles";

export const orientationRequestStatusEnum = pgEnum(
  "orientation_request_status",
  ["NEW", "HANDLED"],
);

// The orientation questionnaire a member sends the team when they don't
// know which course or mentor to pick (dashboard/mentors/orientation). The
// admin answers outside the site (WhatsApp) and marks it HANDLED; one NEW
// request per member at a time. goal/situation/level/weeklyTime hold the
// values of config/goals.ts and config/orientation.ts.
export const orientationRequests = pgTable(
  "orientation_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    goal: text("goal").notNull(),
    situation: text("situation").notNull(),
    level: text("level").notNull(),
    weeklyTime: text("weekly_time").notNull(),
    interests: text("interests").notNull(),
    message: text("message"),
    status: orientationRequestStatusEnum("status").notNull().default("NEW"),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    handledByAdminId: uuid("handled_by_admin_id").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orientation_requests_user_idx").on(table.userId),
    index("orientation_requests_status_idx").on(table.status),
    uniqueIndex("orientation_requests_one_new_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'NEW'`),
  ],
);
