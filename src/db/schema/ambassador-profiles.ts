import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const ambassadorStatusEnum = pgEnum("ambassador_status", [
  "ACTIVE",
  "SUSPENDED",
]);

// Existence of a row here — not a field on profiles — is what "being an
// ambassador" means, same absence-means-locked convention as member_levels
// elsewhere in this codebase. A profile can stay a pure customer for years
// with no row here at all (see BUSINESS_MODEL.md once written). Joining is
// free and explicit (services/ambassador/join-program.ts, not built in this
// phase — this migration only adds the table): termsAcceptedAt/termsVersion
// record that the opt-in actually happened, not just that a column
// defaulted to true.
export const ambassadorProfiles = pgTable(
  "ambassador_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: ambassadorStatusEnum("status").notNull().default("ACTIVE"),
    referralCode: text("referral_code").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    termsAcceptedAt: timestamp("terms_accepted_at", {
      withTimezone: true,
    }).notNull(),
    termsVersion: text("terms_version").notNull(),
  },
  (table) => [
    uniqueIndex("ambassador_profiles_referral_code_unique").on(
      table.referralCode,
    ),
  ],
);
