import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { sales } from "./sales";

// A refund never deletes or rewrites the original sale/commission rows
// (section 22 of the master prompt — a reversal system, not a deletion).
// The actual clawback is a COMMISSION_REVERSAL financial_transactions row
// per commission this sale generated (services/sales/refund-sale.ts, not
// built in this phase) — this row is just the administrative record of the
// decision itself: who initiated it, why, and whether access was revoked.
export const refunds = pgTable("refunds", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id),
  initiatedByAdminId: uuid("initiated_by_admin_id")
    .notNull()
    .references(() => profiles.id),
  reason: text("reason"),
  accessRevoked: boolean("access_revoked").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
