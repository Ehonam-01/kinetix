import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { lessons } from "./courses";
import { profiles } from "./profiles";

// Questions & answers under a lesson, one table for both: a question has
// no parent, an answer points at its question (one level deep — no replies
// to answers). Never hard-deleted: hiding (by its author, by an admin, or
// automatically after enough reports) sets hidden_at, and hidden_reason
// says why, so a moderation decision can always be reviewed or undone.
export const lessonPosts = pgTable(
  "lesson_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => lessonPosts.id, {
      onDelete: "cascade",
    }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    // AUTHOR (deleted by its author), ADMIN, or REPORTS (auto-hidden).
    hiddenReason: text("hidden_reason"),
    hiddenBy: uuid("hidden_by").references(() => profiles.id),
  },
  (table) => [
    index("lesson_posts_lesson_idx").on(table.lessonId, table.createdAt),
    index("lesson_posts_parent_idx").on(table.parentId),
  ],
);

// One report per (post, member). resolved_at is set when an admin has
// dealt with it (hid the post or dismissed the report).
export const lessonPostReports = pgTable(
  "lesson_post_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => lessonPosts.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => profiles.id),
  },
  (table) => [
    uniqueIndex("lesson_post_reports_post_reporter_unique").on(
      table.postId,
      table.reporterId,
    ),
  ],
);
