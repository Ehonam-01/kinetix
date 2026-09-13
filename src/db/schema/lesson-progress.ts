import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { lessons } from "./courses";

// A row only exists once a member marks the lesson done — same convention as
// member_levels/member_rewards: absence means not completed, no
// NOT_STARTED value. No IN_PROGRESS either: external video embeds (the
// Phase 7 hosting choice) give no reliable watch-time signal, so completion
// is a single explicit member action ("marquer comme terminée"), not
// inferred from playback.
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("lesson_progress_user_lesson_unique").on(
      table.userId,
      table.lessonId,
    ),
    index("lesson_progress_user_idx").on(table.userId),
  ],
);
