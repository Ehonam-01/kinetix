import { boolean, jsonb, pgTable, smallint, text } from "drizzle-orm/pg-core";

export type LevelConfig = {
  // Generation sizes in order (G1, G2, ...) — [2,4] for level 1, [2,4,8]
  // for levels 2-5. Admin-configurable (section 29), never hardcoded in
  // service code.
  generationSizes: number[];
};

// Exactly 5 rows, seeded once (see migration 0006). code doubles as the PK
// and the FK target used everywhere else — no separate uuid needed for a
// fixed, small reference table.
export const levels = pgTable("levels", {
  code: smallint("code").primaryKey(),
  name: text("name").notNull(),
  config: jsonb("config").$type<LevelConfig>().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});
