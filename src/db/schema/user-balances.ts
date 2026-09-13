import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// A transactional cache of financial_transactions, updated in the same
// transaction as every ledger insert — never the source of truth by
// itself (section 20). Reconciliation against the ledger is a Phase 10
// concern.
export const userBalances = pgTable("user_balances", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  availableBalance: integer("available_balance").notNull().default(0),
  pendingBalance: integer("pending_balance").notNull().default(0),
  withdrawnBalance: integer("withdrawn_balance").notNull().default(0),
  lifetimeEarnings: integer("lifetime_earnings").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
