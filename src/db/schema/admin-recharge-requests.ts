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
import { financialTransactions } from "./financial-transactions";
import { profiles } from "./profiles";

export const adminRechargeRequestStatusEnum = pgEnum(
  "admin_recharge_request_status",
  ["PENDING_OTP", "CONFIRMED", "EXPIRED"],
);

// An admin-initiated balance credit ("recharge"), OTP-gated exactly like
// wallet_transfers/account_deletion_requests. The OTP always goes to the
// ADMIN's own email (requestedByAdminId) — same reasoning as account-
// deletion-requests.ts's admin-triggered path: it proves it's really the
// admin acting, not the beneficiary's consent, which isn't the point here.
// One row per attempt, never reused — see initiate-recharge.ts.
export const adminRechargeRequests = pgTable(
  "admin_recharge_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    beneficiaryUserId: uuid("beneficiary_user_id")
      .notNull()
      .references(() => profiles.id),
    requestedByAdminId: uuid("requested_by_admin_id")
      .notNull()
      .references(() => profiles.id),
    amount: integer("amount").notNull(),
    reason: text("reason"),
    status: adminRechargeRequestStatusEnum("status")
      .notNull()
      .default("PENDING_OTP"),
    otpCodeHash: text("otp_code_hash").notNull(),
    otpExpiresAt: timestamp("otp_expires_at", {
      withTimezone: true,
    }).notNull(),
    otpAttempts: smallint("otp_attempts").notNull().default(0),
    // Filled in only once CONFIRMED, linking back to the ADJUSTMENT ledger
    // row this recharge produced — same shape as wallet_transfers'
    // senderTransactionId/recipientTransactionId.
    financialTransactionId: uuid("financial_transaction_id").references(
      () => financialTransactions.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("admin_recharge_requests_beneficiary_idx").on(
      table.beneficiaryUserId,
    ),
    index("admin_recharge_requests_admin_idx").on(table.requestedByAdminId),
    index("admin_recharge_requests_status_idx").on(table.status),
  ],
);
