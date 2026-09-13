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

export const withdrawalRequestStatusEnum = pgEnum("withdrawal_request_status", [
  "PENDING_OTP",
  "PENDING_REVIEW",
  "PAID",
  "REJECTED",
  "EXPIRED",
]);

// A member's request to cash out available_balance, gated by an email OTP
// exactly like wallet_transfers (services/wallet/request-withdrawal.ts,
// confirm-withdrawal.ts) — same reasoning: confirming a real payout
// destination deserves the same friction as confirming a recipient.
// Unlike a transfer, funds don't move to another member instantly:
// confirmWithdrawal only moves them from available_balance into
// pending_balance and inserts a PENDING financial_transactions row
// (WITHDRAWAL, negative amount) — no live Moneroo payout integration is
// configured (env.moneroo.ts), so an admin pays out the mobile money
// manually before approveWithdrawal marks this row PAID.
// rejectWithdrawal returns the funds to available_balance and flips both
// this row's status and the linked ledger row's status to REJECTED /
// REVERSED — repositories/financial-transactions.ts's getBalanceHistory
// excludes REVERSED rows from its running sum, so a rejected request never
// shows as money that left.
export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    amount: integer("amount").notNull(),
    payoutPhone: text("payout_phone").notNull(),
    status: withdrawalRequestStatusEnum("status")
      .notNull()
      .default("PENDING_OTP"),
    otpCodeHash: text("otp_code_hash").notNull(),
    otpExpiresAt: timestamp("otp_expires_at", {
      withTimezone: true,
    }).notNull(),
    otpAttempts: smallint("otp_attempts").notNull().default(0),
    financialTransactionId: uuid("financial_transaction_id").references(
      () => financialTransactions.id,
    ),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("withdrawal_requests_user_idx").on(table.userId),
    index("withdrawal_requests_status_idx").on(table.status),
  ],
);
