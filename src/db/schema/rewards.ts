import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { levels } from "./levels";
import { profiles } from "./profiles";

export const rewardTypeEnum = pgEnum("reward_type", [
  "PHYSICAL",
  "CASH",
  "VOUCHER",
  "OTHER",
]);

// Admin-configurable catalog (section 29) — a level can have zero, one, or
// several active rewards; unlockReward grants whichever are active when a
// member completes that level, not a fixed one baked into the level itself.
export const rewards = pgTable("rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  levelCode: smallint("level_code")
    .notNull()
    .references(() => levels.code),
  name: text("name").notNull(),
  description: text("description"),
  value: integer("value").notNull(),
  rewardType: rewardTypeEnum("reward_type").notNull().default("PHYSICAL"),
  // Supabase Storage public URL (reward-images bucket) — set once an admin
  // uploads one, same optional-until-configured pattern as
  // courses.thumbnailUrl. Never required: unlockReward grants the reward
  // regardless of whether a picture exists yet.
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberRewardStatusEnum = pgEnum("member_reward_status", [
  "ELIGIBLE",
  "CLAIMED",
  "PROCESSING",
  "DELIVERED",
]);

// No LOCKED value, same reasoning as member_levels (Phase 4): a row only
// exists once a member is actually eligible — absence means not yet
// unlocked, never stored explicitly.
export const memberRewards = pgTable(
  "member_rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id),
    status: memberRewardStatusEnum("status").notNull().default("ELIGIBLE"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveryAddress: jsonb("delivery_address"),
    trackingInfo: text("tracking_info"),
  },
  (table) => [
    uniqueIndex("member_rewards_user_reward_unique").on(
      table.userId,
      table.rewardId,
    ),
    index("member_rewards_user_idx").on(table.userId),
  ],
);
