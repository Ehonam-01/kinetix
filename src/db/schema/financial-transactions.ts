import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { commissionEvents } from "./commission-events";

// DIRECT_SALE_COMMISSION/GENERATION_COMMISSION/COMMISSION_REVERSAL were
// added for the education-first pivot (BUSINESS_MODEL.md) — added
// alongside DIRECT_COMMISSION/LEVEL_COMMISSION rather than renaming them,
// so historical rows keep their original label untouched (section 28,
// compatibilité). Not yet written by any service in this phase.
export const financialTransactionTypeEnum = pgEnum(
  "financial_transaction_type",
  [
    "DIRECT_COMMISSION",
    "LEVEL_1_BONUS",
    "LEVEL_COMMISSION",
    "REWARD",
    "PAYMENT",
    "REFUND",
    "WITHDRAWAL",
    "ADJUSTMENT",
    "TRANSFER_SENT",
    "TRANSFER_RECEIVED",
    "DIRECT_SALE_COMMISSION",
    "GENERATION_COMMISSION",
    "COMMISSION_REVERSAL",
  ],
);

export const financialTransactionStatusEnum = pgEnum(
  "financial_transaction_status",
  ["PENDING", "COMPLETED", "REVERSED"],
);

// The immutable ledger — the only source of truth for a user's balance
// (section 19). Never deleted; a correction is a new ADJUSTMENT row.
export const financialTransactions = pgTable(
  "financial_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    type: financialTransactionTypeEnum("type").notNull(),
    amount: integer("amount").notNull(),
    status: financialTransactionStatusEnum("status")
      .notNull()
      .default("COMPLETED"),
    reference: text("reference").notNull().unique(),
    relatedLevel: smallint("related_level"),
    relatedGeneration: smallint("related_generation"),
    commissionEventId: uuid("commission_event_id").references(
      () => commissionEvents.id,
    ),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("financial_transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("financial_transactions_type_idx").on(table.type),
  ],
);
