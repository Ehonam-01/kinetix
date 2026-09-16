import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { payments } from "./payments";
import { profiles } from "./profiles";
import { referralClicks } from "./referral-clicks";

// Replaces per-course sales entirely (explicit user decision: "remplacement
// complet" — no course keeps an individual price, see repositories/courses.ts's
// hasCourseAccess). One row per subscription period — a renewal inserts a new
// row rather than updating expiresAt in place, same snapshot/append-only
// philosophy as sales: pricePaid/businessVolume are the values actually paid
// at that moment, never recalculated if subscription.price_in_cfa changes
// later. Access is a pure function of "does the user have any row here with
// expiresAt > now()" (see repositories/subscriptions.ts) — no status column
// and no background job for ACCESS itself, so expiry cuts access off
// immediately by construction (explicit user decision: no grace period).
// reminder7dSentAt/reminder1dSentAt track expiry-reminder emails
// (services/subscriptions/send-expiry-reminders.ts, run by a Vercel Cron
// job) — per-row, not per-user, so a renewal's fresh row is naturally
// eligible for its own reminders again without any reset logic.
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    pricePaid: integer("price_paid").notNull(),
    businessVolume: integer("business_volume").notNull(),
    // Denormalized from attributionId's click, same convention as
    // sales.ambassadorUserId — null means a direct subscription with no
    // ambassador attributed.
    ambassadorUserId: uuid("ambassador_user_id").references(() => profiles.id),
    attributionId: uuid("attribution_id").references(() => referralClicks.id),
    reminder7dSentAt: timestamp("reminder_7d_sent_at", {
      withTimezone: true,
    }),
    reminder1dSentAt: timestamp("reminder_1d_sent_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_user_expires_idx").on(table.userId, table.expiresAt),
    index("subscriptions_ambassador_idx").on(table.ambassadorUserId),
  ],
);
