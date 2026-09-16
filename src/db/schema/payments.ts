import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const paymentMethodEnum = pgEnum("payment_method", [
  "MOBILE_MONEY",
  "ADMIN_CREDIT",
  "WALLET",
]);

// COURSE_PURCHASE is retired (education-first pivot replaced per-course
// pricing with a single annual subscription, see db/schema/subscriptions.ts)
// but kept in the enum: historical payments/sales rows still reference it,
// and Postgres enum values can't be dropped without rewriting every row that
// uses them. No code creates a COURSE_PURCHASE payment anymore — SUBSCRIPTION
// is the only paid course-access product going forward.
export const paymentPurposeEnum = pgEnum("payment_purpose", [
  "REGISTRATION",
  "COURSE_PURCHASE",
  "SUBSCRIPTION",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "CONFIRMED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);

// A payment intent never means "activated" by itself — only a CONFIRMED
// payment triggers services/payments/activate-registration.ts (section 5:
// "ne jamais considérer une simple intention de paiement comme un paiement
// validé"). beneficiaryUserId is whose account this activates;
// payerUserId/grantedByAdminId record who actually paid when that differs
// from the beneficiary (WALLET / ADMIN_CREDIT).
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    beneficiaryUserId: uuid("beneficiary_user_id")
      .notNull()
      .references(() => profiles.id),
    payerUserId: uuid("payer_user_id").references(() => profiles.id),
    grantedByAdminId: uuid("granted_by_admin_id").references(() => profiles.id),
    purpose: paymentPurposeEnum("purpose").notNull().default("REGISTRATION"),
    method: paymentMethodEnum("method").notNull(),
    amount: integer("amount").notNull(),
    provider: text("provider"),
    providerReference: text("provider_reference").unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    index("payments_beneficiary_idx").on(table.beneficiaryUserId),
    index("payments_status_idx").on(table.status),
  ],
);

// Webhook audit log — Moneroo does not send a unique event id (section
// introduction/webhooks.md), only a warning that deliveries can repeat, so
// dedupe_key is derived by the caller (event type + provider transaction
// id) rather than taken verbatim from the payload.
export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").references(() => payments.id),
  dedupeKey: text("dedupe_key").notNull().unique(),
  eventType: text("event_type").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});
