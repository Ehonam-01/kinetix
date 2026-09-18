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
  "PROCESSING",
  "PAID",
  "REJECTED",
  "EXPIRED",
]);

// Bictorys' payout endpoint requires this as a query param per payout —
// same operator values it accepts for inbound charges (services/payments/
// bictorys.ts). Chosen by the member at request time (services/wallet/
// request-withdrawal.ts): unlike inbound checkout, there's no hosted page
// where Bictorys can ask the customer which operator they used, so the
// platform has to know it upfront.
export const mobileMoneyOperatorEnum = pgEnum("mobile_money_operator", [
  "MTN_MONEY",
  "ORANGE_MONEY",
  "WAVE_MONEY",
  "MOOV_MONEY",
  "MOBICASH",
  "TOGOCELL",
  "FREE_MONEY",
]);

// A member's request to cash out available_balance, gated by an email OTP
// exactly like wallet_transfers (services/wallet/request-withdrawal.ts,
// confirm-withdrawal.ts) — same reasoning: confirming a real payout
// destination deserves the same friction as confirming a recipient.
// Unlike a transfer, funds don't move to another member instantly:
// confirmWithdrawal only moves them from available_balance into
// pending_balance and inserts a PENDING financial_transactions row
// (WITHDRAWAL, negative amount). approveWithdrawal (services/admin/
// approve-withdrawal.ts) then triggers a real Bictorys payout and moves the
// row to PROCESSING — it only reaches PAID once the Bictorys webhook
// confirms the transfer actually landed (services/payments/
// handle-payout-webhook.ts), never on the API call's initial 201 alone. A
// failed payout reverts PROCESSING -> PENDING_REVIEW (payoutFailureReason
// set) rather than moving any balance, since the funds never left
// pending_balance in the first place.
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
    // Nullable: rows created before this column existed were already
    // resolved (PAID/REJECTED/EXPIRED) and never need a payout call. Every
    // new request going forward requires it (services/wallet/
    // request-withdrawal.ts).
    operator: mobileMoneyOperatorEnum("operator"),
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
    // Bictorys transaction id for the outbound payout (distinct from
    // financial_transaction_id, which is this platform's own ledger row) —
    // the payout webhook matches back to this row through it.
    payoutProviderReference: text("payout_provider_reference"),
    payoutFailureReason: text("payout_failure_reason"),
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
