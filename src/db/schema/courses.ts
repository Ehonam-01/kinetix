import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { levels } from "./levels";

export const courseStatusEnum = pgEnum("course_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

// Content authoring goes through admin services (services/lms/create-course.ts
// etc., role-checked like every other admin action) — no admin UI yet, same
// situation claimReward/updateRewardDeliveryStatus were in after Phase 6.
//
// slug/price/businessVolume/category/thumbnailUrl/durationMinutes/status
// were added for the education-first pivot (BUSINESS_MODEL.md) — price is
// two distinct integers (price, businessVolume), never assume BV = price
// (section 7 of the master prompt). All stay nullable for now, including
// slug: no real catalog prices exist yet (must never be invented), and
// services/lms/create-course.ts doesn't generate a slug yet either — making
// it NOT NULL here would break that existing insert, which this
// schema-only phase must not do (see the username column's precedent:
// nullable+unique -> backfill -> NOT NULL, three separate migrations,
// never one step that could break a live insert path). Tightened once a
// later phase actually teaches create-course.ts to generate one. status
// coexists with the older isActive for now — every existing query still
// reads isActive unchanged in this phase; reconciling the two (or retiring
// isActive) is deferred to the phase that rewrites hasCourseAccess/the
// admin course list, not done blindly here.
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug"),
    description: text("description"),
    price: integer("price"),
    businessVolume: integer("business_volume"),
    category: text("category"),
    thumbnailUrl: text("thumbnail_url"),
    durationMinutes: integer("duration_minutes"),
    status: courseStatusEnum("status").notNull().default("PUBLISHED"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("courses_slug_unique").on(table.slug)],
);

// Unlike member_levels, absence of rows here means *no restriction* (a free
// course open to any authenticated member), not "locked" — a course becomes
// level-gated only once at least one row is attached. Access is granted if
// the member has unlocked *any* one of the linked levels (OR, not AND) —
// see MLM_RULES.md.
export const courseLevels = pgTable(
  "course_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    levelCode: smallint("level_code")
      .notNull()
      .references(() => levels.code),
  },
  (table) => [
    uniqueIndex("course_levels_course_level_unique").on(
      table.courseId,
      table.levelCode,
    ),
  ],
);

export const modules = pgTable(
  "modules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("modules_course_position_unique").on(
      table.courseId,
      table.position,
    ),
  ],
);

// Videos are hosted externally (YouTube unlisted / Vimeo private) — decided
// in Phase 7 over self-hosting in Supabase Storage or a dedicated video CDN,
// to avoid a new paid vendor. Trade-off accepted knowingly: a leaked
// video_url bypasses level gating, since we only hide the link rather than
// issuing expiring signed access — see DATABASE.md.
export const videoProviderEnum = pgEnum("video_provider", [
  "YOUTUBE",
  "VIMEO",
  "OTHER",
]);

// Added for AI-assisted course generation (ARCHITECTURE.md, "Génération de
// cours par IA") — a lesson is either a video (existing behavior, unchanged)
// or a text article with a comprehension quiz (services/lms/quizzes.ts).
// Every lesson that existed before this column defaults to VIDEO, matching
// what it already was — this is purely additive.
export const lessonTypeEnum = pgEnum("lesson_type", ["VIDEO", "TEXT"]);

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    lessonType: lessonTypeEnum("lesson_type").notNull().default("VIDEO"),
    // videoProvider/videoUrl were NOT NULL before TEXT lessons existed —
    // loosened rather than split into a separate table, since every other
    // lesson field (title, description, position, isActive) is shared
    // regardless of type. required-when-VIDEO is enforced in
    // services/lms/create-lesson.ts and update-lesson.ts, not in the schema.
    videoProvider: videoProviderEnum("video_provider"),
    videoUrl: text("video_url"),
    // The article body for a TEXT lesson — null for VIDEO lessons.
    content: text("content"),
    position: integer("position").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("lessons_module_position_unique").on(
      table.moduleId,
      table.position,
    ),
  ],
);
