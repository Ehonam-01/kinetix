import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { payments } from "./payments";

export const workshopRegistrationStatusEnum = pgEnum(
  "workshop_registration_status",
  ["PENDING", "PAID", "FAILED"],
);

export const workshopRegistrationSourceEnum = pgEnum(
  "workshop_registration_source",
  ["ONLINE", "ADMIN"],
);

// A paid in-person workshop, with its settings in this one row (edited from
// /admin/atelier, so a change needs no deploy). capacity only decides when
// the online sale stops and visitors are sent to WhatsApp: explicit user
// decision, nothing in the database refuses a registration past it, and a
// payment confirmed past it keeps its seat.
export const workshops = pgTable("workshops", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  priceCfa: integer("price_cfa").notNull(),
  // The value shown crossed out next to the price.
  regularPriceCfa: integer("regular_price_cfa").notNull(),
  capacity: integer("capacity").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  venue: text("venue").notNull(),
  whatsappGroupUrl: text("whatsapp_group_url"),
  registrationsOpen: boolean("registrations_open").notNull().default(true),
  // Last moment a participant's code still takes money off a subscription.
  discountValidUntil: timestamp("discount_valid_until", {
    withTimezone: true,
  }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// One participant. They have no account: accessToken, in the link of their
// confirmation page, is what proves who they are. paymentId is null for a
// registration an admin adds after being paid off-site (source ADMIN).
//
// discountCode only exists once PAID. A subscription payment started with
// it holds it for a short while (discountReservedUntil), and only a
// confirmed subscription spends it (discountUsedAt).
export const workshopRegistrations = pgTable(
  "workshop_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workshopId: uuid("workshop_id")
      .notNull()
      .references(() => workshops.id),
    fullName: text("full_name").notNull(),
    // International number in digits only (lib/whatsapp.ts).
    whatsapp: text("whatsapp").notNull(),
    email: text("email"),
    city: text("city").notNull(),
    status: workshopRegistrationStatusEnum("status")
      .notNull()
      .default("PENDING"),
    source: workshopRegistrationSourceEnum("source")
      .notNull()
      .default("ONLINE"),
    amount: integer("amount").notNull(),
    paymentId: uuid("payment_id")
      .unique()
      .references(() => payments.id),
    accessToken: text("access_token").notNull().unique(),
    discountCode: text("discount_code").unique(),
    discountReservedUntil: timestamp("discount_reserved_until", {
      withTimezone: true,
    }),
    discountUsedAt: timestamp("discount_used_at", { withTimezone: true }),
    discountPaymentId: uuid("discount_payment_id").references(
      () => payments.id,
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workshop_registrations_workshop_status_idx").on(
      table.workshopId,
      table.status,
    ),
    index("workshop_registrations_whatsapp_idx").on(
      table.workshopId,
      table.whatsapp,
    ),
  ],
);
