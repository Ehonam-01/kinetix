import {
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const mentorshipStatusEnum = pgEnum("mentorship_status", [
  "REQUESTED",
  "ACCEPTED",
  "DECLINED",
]);

// A mentee's declared relationship with a mentor — the prerequisite this
// app didn't have for gating reviews on "a real accompagnement happened"
// instead of letting any member rate any mentor. The mentor's own
// accept/decline (services/mentorship/respond-to-mentorship-request.ts) is
// what makes this a genuine two-sided confirmation rather than a mentee's
// unilateral claim, same reasoning admin validation exists for mentor
// status itself (mentor-profiles.ts) rather than a self-declared flag.
// One row per (mentor, mentee) pair — a declined request can be
// re-requested, which resets this exact row (services/mentorship/
// request-mentorship.ts) rather than inserting a second one.
export const mentorships = pgTable(
  "mentorships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mentorUserId: uuid("mentor_user_id")
      .notNull()
      .references(() => profiles.id),
    menteeUserId: uuid("mentee_user_id")
      .notNull()
      .references(() => profiles.id),
    status: mentorshipStatusEnum("status").notNull().default("REQUESTED"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("mentorships_mentor_mentee_unique").on(
      table.mentorUserId,
      table.menteeUserId,
    ),
    index("mentorships_mentor_idx").on(table.mentorUserId),
    index("mentorships_mentee_idx").on(table.menteeUserId),
  ],
);

// One review per ACCEPTED mentorship (checked in services/mentorship/
// submit-mentor-review.ts, not enforceable as a DB constraint since it
// depends on another table's row) — mentorshipId unique means a second
// submission updates the same row (onConflictDoUpdate) instead of
// accumulating duplicate reviews for the same relationship.
// mentorUserId/menteeUserId are denormalized from the mentorship row,
// same convention as subscriptions.ambassadorUserId, so listing/aggregating
// a mentor's reviews never needs to join through mentorships at all.
export const mentorReviews = pgTable(
  "mentor_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mentorshipId: uuid("mentorship_id")
      .notNull()
      .unique()
      .references(() => mentorships.id),
    mentorUserId: uuid("mentor_user_id")
      .notNull()
      .references(() => profiles.id),
    menteeUserId: uuid("mentee_user_id")
      .notNull()
      .references(() => profiles.id),
    // 1-5, validated in schemas/mentor-review.ts — no DB check constraint,
    // same convention as every other bounded value in this codebase
    // (e.g. BICTORYS_MERCHANT_SECRET_CODE's 4-digit shape).
    rating: smallint("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("mentor_reviews_mentor_idx").on(table.mentorUserId)],
);
