import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { payments } from "./payments";

export const workshopRegistrationStatusEnum = pgEnum(
  "workshop_registration_status",
  ["PENDING", "PAID", "FAILED"],
);

export const workshopRegistrationSourceEnum = pgEnum(
  "workshop_registration_source",
  ["ONLINE", "ADMIN"],
);

// A paid in-person workshop session, with its settings in its own row
// (edited from /admin/atelier, so a change needs no deploy). capacity only
// decides when the online sale stops and visitors are sent to WhatsApp:
// explicit user decision, nothing in the database refuses a registration
// past it, and a payment confirmed past it keeps its seat.
//
// The row with slug "atelier-video-ia" is the sales page: its videos are
// the page's (and it was itself the first session, Lomé, 14 November).
// The same workshop given in several cities (explicit user decision: its
// own date, place, price and seats in each) is one row per city, pointing
// at the page through pageId; the page sells those sessions.
export const workshops = pgTable("workshops", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  pageId: uuid("page_id").references((): AnyPgColumn => workshops.id),
  city: text("city"),
  priceCfa: integer("price_cfa").notNull(),
  // The value shown crossed out next to the price.
  regularPriceCfa: integer("regular_price_cfa").notNull(),
  capacity: integer("capacity").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  venue: text("venue").notNull(),
  whatsappGroupUrl: text("whatsapp_group_url"),
  // Up to three YouTube links, shown at the top of the sales page.
  exampleVideoUrls: text("example_video_urls")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  // A YouTube link, shown full width under the top of the sales page.
  heroVideoUrl: text("hero_video_url"),
  // YouTube links for the slider further down the page, playing muted
  // on their own; separate from the three cards at the top.
  sliderVideoUrls: text("slider_video_urls")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  // The title under each slider video, same order as sliderVideoUrls ("":
  // none).
  sliderVideoTitles: text("slider_video_titles")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
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
    // What the seat costs this participant (the price, or what an admin
    // recorded), and what has been received towards it so far. A seat is
    // PAID, held, from its first confirmed payment (explicit user decision:
    // participants may pay in parts, from 1 000 F, until the day, and the
    // rest at the door); paid in full once amountPaid reaches amount.
    amount: integer("amount").notNull(),
    amountPaid: integer("amount_paid").notNull().default(0),
    // The first payment. Later ones point back here through their
    // metadata.workshopRegistrationId (repositories/workshops.ts).
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

export const workshopTestimonialKindEnum = pgEnum("workshop_testimonial_kind", [
  "TEXT",
  "IMAGE",
]);

// What participants said after a session, shown on the sales page (explicit
// user decision: managed from /admin/atelier). Only ever real ones, entered
// by an admin: a written review (authorName, body), or a screenshot of a
// message received (imageUrl, in the course-thumbnails storage bucket,
// under workshop-testimonials/). Hidden ones (isPublished false) stay for
// the admin.
export const workshopTestimonials = pgTable(
  "workshop_testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The sales page's row (repositories/workshops.ts getWorkshop).
    workshopId: uuid("workshop_id")
      .notNull()
      .references(() => workshops.id),
    kind: workshopTestimonialKindEnum("kind").notNull(),
    authorName: text("author_name"),
    // A city, a trade, the session attended: free text.
    authorDetail: text("author_detail"),
    body: text("body"),
    imageUrl: text("image_url"),
    position: integer("position").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workshop_testimonials_workshop_idx").on(
      table.workshopId,
      table.position,
    ),
  ],
);
