import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { profiles } from "./profiles";

// A learner's rating (1 to 5 stars) and optional comment on a course
// (services/lms/course-reviews.ts): one per member and course, edited in
// place. Only a member who has the course and completed at least one of its
// lessons can leave one. hiddenAt: hidden by an admin (admin/reviews) —
// left out of every average and list, the author is not told.
export const courseReviews = pgTable(
  "course_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenBy: uuid("hidden_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("course_reviews_one_per_member").on(
      table.courseId,
      table.userId,
    ),
    index("course_reviews_course_idx").on(table.courseId),
    check("course_reviews_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);
