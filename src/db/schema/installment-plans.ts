import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { payments } from "./payments";
import { profiles } from "./profiles";
import { referralClicks } from "./referral-clicks";

export const installmentPlanStatusEnum = pgEnum("installment_plan_status", [
  "OPEN",
  "COMPLETED",
  "EXPIRED",
]);

// Paying the first annual subscription in several deposits ("cagnotte",
// services/subscriptions/installments.ts). Each deposit is a payments row
// with purpose INSTALLMENT (metadata.installmentPlanId); once paidAmount
// reaches targetAmount, a regular SUBSCRIPTION payment for targetAmount is
// created and confirmed in the same transaction, so the subscription,
// account activation and the sponsor's commission happen exactly as for a
// one-off payment — and only then.
//
// targetAmount is the price when the plan was opened, kept even if the
// price changes. The deadline starts with the first confirmed deposit
// (INSTALLMENT_MONTHS later): past it with the target not reached, the
// plan is EXPIRED and what was paid is owed back minus the withdrawal fees
// (refundAmount/refundFee, snapshotted then), paid by an admin to
// refundPhone and recorded with refundedAt.
export const installmentPlans = pgTable(
  "installment_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    targetAmount: integer("target_amount").notNull(),
    paidAmount: integer("paid_amount").notNull().default(0),
    status: installmentPlanStatusEnum("status").notNull().default("OPEN"),
    // Attribution captured when the plan opens, used by the final
    // subscription payment — same values a one-off payment would carry.
    ambassadorUserId: uuid("ambassador_user_id").references(() => profiles.id),
    attributionId: uuid("attribution_id").references(() => referralClicks.id),
    firstDepositAt: timestamp("first_deposit_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    subscriptionPaymentId: uuid("subscription_payment_id").references(
      () => payments.id,
    ),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    refundAmount: integer("refund_amount"),
    refundFee: integer("refund_fee"),
    // Where to send the refund: the mobile money account of the last
    // confirmed deposit ({ country, operator, phone }).
    refundPayout: jsonb("refund_payout"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundedByAdminId: uuid("refunded_by_admin_id").references(
      () => profiles.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("installment_plans_user_idx").on(table.userId),
    index("installment_plans_status_idx").on(table.status),
    // At most one open plan per member.
    uniqueIndex("installment_plans_one_open_per_user")
      .on(table.userId)
      .where(sql`${table.status} = 'OPEN'`),
  ],
);
