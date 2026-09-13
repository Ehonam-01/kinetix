import {
  pgEnum,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { levels } from "./levels";

export const memberLevelStatusEnum = pgEnum("member_level_status", [
  "IN_PROGRESS",
  "COMPLETED",
]);

// A row only exists once a member has unlocked that level — there is no
// LOCKED status to store, absence of a row means locked (see
// ARCHITECTURE.md / MLM_RULES.md, déclencheur unique).
export const memberLevels = pgTable(
  "member_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    levelCode: smallint("level_code")
      .notNull()
      .references(() => levels.code),
    status: memberLevelStatusEnum("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("member_levels_user_level_unique").on(
      table.userId,
      table.levelCode,
    ),
  ],
);
