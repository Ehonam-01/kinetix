import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const mentorRequestStatusEnum = pgEnum("mentor_request_status", [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

// A member's request to be listed as a mentor in one domain — category is
// free text, deliberately not its own enum: it reuses whatever values
// admins have already typed into courses.category (repositories/courses.ts's
// listDistinctCourseCategories), the same "no separate taxonomy to
// maintain" choice courses.ts itself made. One row per user (unique
// userId), not one per domain: the product decision is a single declared
// domain per mentor for now, same simplicity as ambassador_profiles being
// one row per user.
//
// requestMentorStatus (services/mentorship/request-mentor-status.ts) is the
// only place that resubmits a REJECTED row back to PENDING_REVIEW —
// approve/reject (services/admin/*-mentor-request.ts) mirror
// approve-withdrawal.ts/reject-withdrawal.ts exactly: reviewedBy/reviewedAt
// stamped on every decision, rejectionReason required on refusal.
export const mentorProfiles = pgTable("mentor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => profiles.id),
  category: text("category").notNull(),
  pitch: text("pitch"),
  status: mentorRequestStatusEnum("status").notNull().default("PENDING_REVIEW"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
});
