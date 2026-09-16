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
import { payments } from "./payments";
import { profiles } from "./profiles";
import { referralClicks } from "./referral-clicks";

export const subscriptionWalletStatusEnum = pgEnum(
  "subscription_wallet_status",
  ["PENDING_OTP", "CONFIRMED", "EXPIRED"],
);

// The subscription's pendant of the old course_purchase_wallet_requests
// (retired by the same pivot) — a subscription funded from a member's
// available_balance instead of Mobile Money. walletUserId is whichever
// member's balance actually pays (the buyer's own, or someone else's, named
// by pseudo), gated by an email OTP sent to walletUserId, not buyerUserId:
// the person whose balance is debited is the one who must authorize it, same
// reasoning as wallet_transfers.
export const subscriptionWalletRequests = pgTable(
  "subscription_wallet_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => profiles.id),
    walletUserId: uuid("wallet_user_id")
      .notNull()
      .references(() => profiles.id),
    amount: integer("amount").notNull(),
    ambassadorUserId: uuid("ambassador_user_id").references(() => profiles.id),
    attributionId: uuid("attribution_id").references(() => referralClicks.id),
    status: subscriptionWalletStatusEnum("status")
      .notNull()
      .default("PENDING_OTP"),
    otpCodeHash: text("otp_code_hash").notNull(),
    otpExpiresAt: timestamp("otp_expires_at", {
      withTimezone: true,
    }).notNull(),
    otpAttempts: smallint("otp_attempts").notNull().default(0),
    paymentId: uuid("payment_id").references(() => payments.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("subscription_wallet_requests_buyer_idx").on(table.buyerUserId),
    index("subscription_wallet_requests_wallet_idx").on(table.walletUserId),
    index("subscription_wallet_requests_status_idx").on(table.status),
  ],
);
