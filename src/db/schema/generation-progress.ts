import {
  integer,
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { levels } from "./levels";

export const generationStatusEnum = pgEnum("generation_status", [
  "PENDING",
  "COMPLETED",
]);

// Drives commission triggers: crossing requiredCount for the first time
// (PENDING -> COMPLETED) is the one moment a commission_event is created
// for (user, level, generation) — see services/mlm/unlock-level.ts.
//
// bvTotal was added for the education-first pivot (BUSINESS_MODEL.md):
// accumulated Business Volume from qualifying sales attributed to members
// in this generation, alongside currentCount's plain headcount. Not wired
// into unlock-level.ts's qualification gate in this phase — that rewrite
// (currentCount >= requiredCount replaced by reading
// commission_rules.qualificationRequirement) is a later phase, this column
// only makes room for it.
export const generationProgress = pgTable(
  "generation_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    levelCode: smallint("level_code")
      .notNull()
      .references(() => levels.code),
    generation: smallint("generation").notNull(),
    requiredCount: smallint("required_count").notNull(),
    currentCount: smallint("current_count").notNull().default(0),
    bvTotal: integer("bv_total").notNull().default(0),
    status: generationStatusEnum("status").notNull().default("PENDING"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("generation_progress_user_level_gen_unique").on(
      table.userId,
      table.levelCode,
      table.generation,
    ),
  ],
);
