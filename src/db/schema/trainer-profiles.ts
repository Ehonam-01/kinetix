import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const trainerRequestStatusEnum = pgEnum("trainer_request_status", [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

// A member's application to teach a course on Kinetix (dashboard/
// become-trainer), reviewed by an admin (admin/trainers) — the same shape
// as mentor_profiles: one row per member, a REJECTED one resubmitted in
// place (services/trainers/request-trainer-status.ts), reviewedBy/
// reviewedAt stamped on every decision, a reason required on refusal.
// Approval doesn't publish anything by itself: the team then works with
// the trainer on the course.
export const trainerProfiles = pgTable("trainer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => profiles.id),
  // The field taught (e.g. "Marketing digital").
  domain: text("domain").notNull(),
  // The course the member proposes, and what it would cover.
  courseTitle: text("course_title").notNull(),
  courseOutline: text("course_outline").notNull(),
  // Why them: experience, achievements, teaching.
  experience: text("experience").notNull(),
  // Portfolio, LinkedIn, sample video… (optional).
  sampleUrl: text("sample_url"),
  status: trainerRequestStatusEnum("status")
    .notNull()
    .default("PENDING_REVIEW"),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  reviewedBy: uuid("reviewed_by").references(() => profiles.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
});
