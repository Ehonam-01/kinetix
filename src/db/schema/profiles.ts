import {
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Not managed by our migrations — points at Supabase's own auth.users table,
// declared only so profiles.id can carry a real foreign key.
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const profileRoleEnum = pgEnum("profile_role", ["USER", "ADMIN"]);

// PENDING_PAYMENT is the default: a profile exists once the email is
// verified, but the account isn't ACTIVE until registration payment is
// confirmed (Phase 5). See MLM_RULES.md once written.
export const profileStatusEnum = pgEnum("profile_status", [
  "PENDING_PAYMENT",
  "ACTIVE",
  "SUSPENDED",
]);

export const profiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  // Public display handle (shown under a member's node in the genealogy
  // tree) — distinct from fullName, which stays private/administrative.
  // Every new registration requires it (see schemas/auth.ts); profiles
  // created before this column existed were backfilled by migration 0016.
  username: text("username").notNull().unique(),
  phone: text("phone"),
  country: text("country"),
  role: profileRoleEnum("role").notNull().default("USER"),
  status: profileStatusEnum("status").notNull().default("PENDING_PAYMENT"),
  // Community directory fields (Phase B, first building block) — all
  // optional and self-service (dashboard/settings), never required at
  // registration. goal stores one of config/goals.ts's GOAL_OPTIONS
  // values, same taxonomy the homepage's "Que veux-tu accomplir ?" picker
  // uses, so a member's stated goal and the marketing copy never drift
  // apart. No avatar/photo field yet — no upload infra exists for it,
  // initials-based avatars cover v1.
  bio: text("bio"),
  goal: text("goal"),
  skills: jsonb("skills").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
