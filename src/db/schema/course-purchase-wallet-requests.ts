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
import { courses } from "./courses";
import { payments } from "./payments";
import { profiles } from "./profiles";
import { referralClicks } from "./referral-clicks";

export const coursePurchaseWalletStatusEnum = pgEnum(
  "course_purchase_wallet_status",
  ["PENDING_OTP", "CONFIRMED", "EXPIRED"],
);

// A course purchase funded from a member's available_balance instead of
// Mobile Money — walletUserId is whichever member's balance actually pays
// (the buyer's own, or someone else's, named by pseudo), gated by an email
// OTP sent to walletUserId, not buyerUserId, exactly like wallet_transfers:
// the person whose balance is debited is the one who must authorize it,
// same reasoning that already applies to a transfer's sender. When
// walletUserId === buyerUserId this is just "pay with my own balance" and
// the OTP still lands in the buyer's own inbox.
//
// ambassadorUserId/attributionId are captured here at request time (the
// only moment a request context with cookies exists — see
// services/sales/request-course-purchase-wallet.ts) and copied into
// payments.metadata at confirm time, the same two-step split
// initiateCoursePurchase/confirmCoursePurchase already uses for the Mobile
// Money path.
export const coursePurchaseWalletRequests = pgTable(
  "course_purchase_wallet_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => profiles.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    walletUserId: uuid("wallet_user_id")
      .notNull()
      .references(() => profiles.id),
    amount: integer("amount").notNull(),
    ambassadorUserId: uuid("ambassador_user_id").references(() => profiles.id),
    attributionId: uuid("attribution_id").references(() => referralClicks.id),
    status: coursePurchaseWalletStatusEnum("status")
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
    index("course_purchase_wallet_requests_buyer_idx").on(table.buyerUserId),
    index("course_purchase_wallet_requests_wallet_idx").on(table.walletUserId),
    index("course_purchase_wallet_requests_status_idx").on(table.status),
  ],
);
