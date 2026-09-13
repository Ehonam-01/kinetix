import {
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { levels } from "./levels";

// DIRECT_SALE/GENERATION added for the education-first pivot
// (BUSINESS_MODEL.md) — added alongside DIRECT/LEVEL_COMMISSION rather than
// renaming them, so historical rows keep their original label (section 28,
// compatibilité). DIRECT was "a sponsor's filleul registered"; DIRECT_SALE
// is "an ambassador's attributed sale was confirmed". LEVEL_COMMISSION is
// "a generation completed by headcount alone, no commission_rules row
// configured for it"; GENERATION is "a generation completed under an
// admin-configured commission_rules row" (BV-aware or not) — see
// services/mlm/unlock-level.ts's maybeCompleteGeneration.
export const commissionTypeEnum = pgEnum("commission_type", [
  "DIRECT",
  "LEVEL_1_BONUS",
  "LEVEL_COMMISSION",
  "DIRECT_SALE",
  "GENERATION",
]);

// The idempotency gate (section 15): a commission is created here at most
// once per dedupe_key, before ever touching the ledger. See
// services/mlm/commission.ts.
export const commissionEvents = pgTable(
  "commission_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    beneficiaryUserId: uuid("beneficiary_user_id")
      .notNull()
      .references(() => profiles.id),
    sourceUserId: uuid("source_user_id").references(() => profiles.id),
    type: commissionTypeEnum("type").notNull(),
    levelCode: smallint("level_code").references(() => levels.code),
    generation: smallint("generation"),
    amount: integer("amount").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_events_beneficiary_idx").on(
      table.beneficiaryUserId,
      table.createdAt,
    ),
  ],
);
