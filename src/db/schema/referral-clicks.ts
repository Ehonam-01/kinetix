import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { profiles } from "./profiles";

// One row per click on an ambassador's referral link — a dedicated tracking
// table rather than a single cookie value on the sale, chosen explicitly
// over the simpler alternative so a future report can answer "how many
// clicks turned into a sale," not only "who gets credit for this one." A
// sale resolves its attribution by finding the most recent click for the
// same visitorToken still inside the configurable attribution window
// (parameter_versions key attribution.cookie_days) — see
// services/attribution/resolve-referral.ts (not built in this phase).
export const referralClicks = pgTable(
  "referral_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ambassadorUserId: uuid("ambassador_user_id")
      .notNull()
      .references(() => profiles.id),
    visitorToken: text("visitor_token").notNull(),
    // Nullable: a referral link can point at one specific course or just at
    // the ambassador's general profile/landing page.
    courseId: uuid("course_id").references(() => courses.id),
    landingPath: text("landing_path"),
    clickedAt: timestamp("clicked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("referral_clicks_visitor_idx").on(
      table.visitorToken,
      table.clickedAt,
    ),
    index("referral_clicks_ambassador_idx").on(table.ambassadorUserId),
  ],
);
