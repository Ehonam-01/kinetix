import {
  boolean,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { lessons } from "./courses";
import { profiles } from "./profiles";

// One quiz per TEXT lesson (see courses.ts's lessonTypeEnum) — the
// comprehension check a learner must pass before the next lesson unlocks
// (services/lms/quiz-progress.ts). passingScore is a percentage (0-100),
// admin-configurable per quiz rather than hardcoded "must get 100%".
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    passingScore: smallint("passing_score").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("quizzes_lesson_id_unique").on(table.lessonId)],
);

export type QuizOption = { id: string; text: string; isCorrect: boolean };

// Options live as jsonb on the question row itself rather than a 4th table
// (quiz_options) — same call as levels.config: a small, always-loaded-
// together, admin-authored list that's never queried independently of its
// parent question.
export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").$type<QuizOption[]>().notNull(),
  position: integer("position").notNull(),
});

// One row per submitted attempt (never overwritten) — a learner can retry a
// failed quiz, and each try is kept for review/audit rather than just the
// latest result. "Has this learner passed this quiz" is derived by querying
// for an existing passed=true row (same absence-means-not-done convention
// as lesson_progress), not a separate status column here.
export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  score: smallint("score").notNull(),
  passed: boolean("passed").notNull(),
  // Snapshot of what was submitted (questionId -> selected option id) —
  // kept for the "here's what you got wrong" retry screen.
  answers: jsonb("answers").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
