import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Admin → Marketing (app/admin/marketing). Singleton row (fixed id
// "default"), same convention as payment_settings: the Meta (Facebook)
// pixel id, loaded on the site only after the visitor accepts it
// (components/marketing/marketing-consent.tsx). null = no pixel.
export const marketingSettings = pgTable("marketing_settings", {
  id: text("id").primaryKey().default("default"),
  metaPixelId: text("meta_pixel_id"),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One row per arrival from a campaign link (utm_* parameters) or from an
// outside site (referrerHost), recorded by app/api/marketing/visit. The
// first one of a browser is kept in a cookie (visitorToken) and copied to
// signup_sources when that visitor signs up — that's how a sign-up and its
// payment are credited to a campaign.
export const marketingVisits = pgTable(
  "marketing_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    visitorToken: uuid("visitor_token").notNull(),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),
    referrerHost: text("referrer_host"),
    landingPath: text("landing_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("marketing_visits_created_idx").on(table.createdAt),
    index("marketing_visits_token_idx").on(table.visitorToken),
  ],
);

// Where a member came from when they signed up: the first campaign visit
// of their browser (first touch), copied at profile creation
// (services/auth/ensure-profile.ts). No row = no campaign or outside site
// recorded (direct visit, referral link, another browser).
export const signupSources = pgTable("signup_sources", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id),
  visitId: uuid("visit_id").references(() => marketingVisits.id),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  referrerHost: text("referrer_host"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
