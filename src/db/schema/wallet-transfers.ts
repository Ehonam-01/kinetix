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

export const walletTransferStatusEnum = pgEnum("wallet_transfer_status", [
  "PENDING_OTP",
  "CONFIRMED",
  "EXPIRED",
]);

// A member-to-member balance transfer, gated by an email OTP
// (services/wallet/initiate-transfer.ts, confirm-transfer.ts). One row per
// attempt — initiateTransfer always creates a fresh row rather than
// reusing a pending one, so otpAttempts/otpCodeHash never carry over across
// unrelated recipients/amounts. senderTransactionId/recipientTransactionId
// are filled in only once CONFIRMED, linking back to the two
// financial_transactions rows the transfer produced (TRANSFER_SENT /
// TRANSFER_RECEIVED) — the transfer row itself is never the balance source
// of truth, the ledger is.
export const walletTransfers = pgTable(
  "wallet_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => profiles.id),
    amount: integer("amount").notNull(),
    status: walletTransferStatusEnum("status").notNull().default("PENDING_OTP"),
    otpCodeHash: text("otp_code_hash").notNull(),
    otpExpiresAt: timestamp("otp_expires_at", {
      withTimezone: true,
    }).notNull(),
    otpAttempts: smallint("otp_attempts").notNull().default(0),
    senderTransactionId: uuid("sender_transaction_id").references(
      () => financialTransactions.id,
    ),
    recipientTransactionId: uuid("recipient_transaction_id").references(
      () => financialTransactions.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("wallet_transfers_sender_idx").on(table.senderId),
    index("wallet_transfers_recipient_idx").on(table.recipientId),
    index("wallet_transfers_status_idx").on(table.status),
  ],
);
