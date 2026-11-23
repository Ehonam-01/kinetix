import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Members' testimonials on the homepage (explicit user decision: a table
// managed from /admin/temoignages). Only ever real ones, entered by an
// admin with the member's agreement — none is ever written by the code.
// The homepage section stays hidden while none is published.
export const siteTestimonials = pgTable(
  "site_testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    city: text("city"),
    // The course they followed, as free text.
    courseTitle: text("course_title"),
    quote: text("quote").notNull(),
    // In the course-thumbnails storage bucket, under site-testimonials/.
    photoUrl: text("photo_url"),
    // A YouTube link, optional.
    videoUrl: text("video_url"),
    position: integer("position").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("site_testimonials_position_idx").on(table.position)],
);
