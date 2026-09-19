import {
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const accountDeletionRequestStatusEnum = pgEnum(
  "account_deletion_request_status",
  ["PENDING_OTP", "CONFIRMED", "EXPIRED"],
);

// OTP-gated exactly like withdrawal_requests/wallet_transfers — same
// reasoning: an irreversible action deserves the same friction. Unlike
// those, there's no amount/recipient to carry across the OTP step, just
// which profile is being deleted and who asked for it — requestedByUserId
// is the target themself for self-service (dashboard/settings) or an admin
// for admin-triggered deletion (admin/members/[userId]); the OTP always
// goes to requestedByUserId's own email (services/account/request-account-
// deletion.ts), proving it's really them, not the target's consent.
export const accountDeletionRequests = pgTable(
  "account_deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetUserId: uuid("target_user_id")
      .notNull()
      .references(() => profiles.id),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => profiles.id),
    status: accountDeletionRequestStatusEnum("status")
      .notNull()
      .default("PENDING_OTP"),
    otpCodeHash: text("otp_code_hash").notNull(),
    otpExpiresAt: timestamp("otp_expires_at", {
      withTimezone: true,
    }).notNull(),
    otpAttempts: smallint("otp_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("account_deletion_requests_target_idx").on(table.targetUserId),
    index("account_deletion_requests_status_idx").on(table.status),
  ],
);
