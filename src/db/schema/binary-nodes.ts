import {
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

// Postgres' ltree type isn't a Drizzle built-in — represented as a plain
// string (dot-separated labels). Actual tree queries (<@, @>, nlevel())
// go through raw SQL in the repository layer, see ARCHITECTURE.md.
const ltree = customType<{ data: string }>({
  dataType() {
    return "ltree";
  },
});

export const binaryPositionEnum = pgEnum("binary_position", ["LEFT", "RIGHT"]);

export const placementMethodEnum = pgEnum("placement_method", [
  "AUTO_GREEDY",
  "MANUAL",
  "ADMIN_OVERRIDE",
]);

// The single source of truth for every member's position, reused by all 5
// levels (decision validated in the architecture report — see
// ARCHITECTURE.md "Généalogie : adjacency list + ltree"). Rows are
// immutable once inserted: never reassign binary_parent_id/binary_position
// after placement.
export const binaryNodes = pgTable(
  "binary_nodes",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    binaryParentId: uuid("binary_parent_id").references(
      (): AnyPgColumn => binaryNodes.id,
    ),
    binaryPosition: binaryPositionEnum("binary_position"),
    path: ltree("path").notNull(),
    depth: integer("depth").notNull(),
    leftSubtreeCount: integer("left_subtree_count").notNull().default(0),
    rightSubtreeCount: integer("right_subtree_count").notNull().default(0),
    placementMethod: placementMethodEnum("placement_method")
      .notNull()
      .default("AUTO_GREEDY"),
    placedAt: timestamp("placed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("binary_nodes_user_id_unique").on(table.userId),
    index("binary_nodes_parent_idx").on(table.binaryParentId),
    index("binary_nodes_depth_idx").on(table.depth),
  ],
);
