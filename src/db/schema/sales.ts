import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { payments } from "./payments";
import { profiles } from "./profiles";
import { referralClicks } from "./referral-clicks";

export const saleStatusEnum = pgEnum("sale_status", ["CONFIRMED", "REFUNDED"]);

// The commercial record a course purchase produces — distinct from
// payments (the payment-intent/provider layer): a sale only ever exists
// once a payment is CONFIRMED, the same non-negotiable rule as
// activate-registration.ts today (never treat a payment intent as a
// validated payment). pricePaid/businessVolume are snapshots taken at sale
// time, never recalculated if the course's price/BV changes later — same
// non-retroactivity principle as commission_events. ambassadorUserId is
// denormalized from attributionId's click for simple querying/joins; null
// means a direct purchase with no ambassador attributed, a legitimate,
// expected state (section 9 of the master prompt), not an error.
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => profiles.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    pricePaid: integer("price_paid").notNull(),
    businessVolume: integer("business_volume").notNull(),
    ambassadorUserId: uuid("ambassador_user_id").references(
      () => profiles.id,
    ),
    attributionId: uuid("attribution_id").references(() => referralClicks.id),
    status: saleStatusEnum("status").notNull().default("CONFIRMED"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("sales_buyer_idx").on(table.buyerUserId),
    index("sales_ambassador_idx").on(table.ambassadorUserId),
    index("sales_course_idx").on(table.courseId),
  ],
);
