import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Generic versioned key-value store for every configurable financial
// parameter (registration price, commissions, bonuses...). Never updated
// in place: changing a value closes the current row (effective_to = now())
// and inserts a new one — commission_events snapshot the amount actually
// used, so history never gets recalculated retroactively (section 29/43).
export const parameterVersions = pgTable(
  "parameter_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parameterKey: text("parameter_key").notNull(),
    value: integer("value").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("parameter_versions_key_effective_idx").on(
      table.parameterKey,
      table.effectiveFrom,
    ),
  ],
);
