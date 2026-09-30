CREATE TABLE "lesson_post_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "lesson_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_reason" text,
	"hidden_by" uuid
);
--> statement-breakpoint
ALTER TABLE "lesson_post_reports" ADD CONSTRAINT "lesson_post_reports_post_id_lesson_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."lesson_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_post_reports" ADD CONSTRAINT "lesson_post_reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_post_reports" ADD CONSTRAINT "lesson_post_reports_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_posts" ADD CONSTRAINT "lesson_posts_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_posts" ADD CONSTRAINT "lesson_posts_parent_id_lesson_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lesson_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_posts" ADD CONSTRAINT "lesson_posts_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_posts" ADD CONSTRAINT "lesson_posts_hidden_by_profiles_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_post_reports_post_reporter_unique" ON "lesson_post_reports" USING btree ("post_id","reporter_id");--> statement-breakpoint
CREATE INDEX "lesson_posts_lesson_idx" ON "lesson_posts" USING btree ("lesson_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_posts_parent_idx" ON "lesson_posts" USING btree ("parent_id");--> statement-breakpoint
-- Same posture as every other table (security audit M5, migration 0054):
-- RLS on with no policy, so only the server (which bypasses RLS) reads and
-- writes them; the default privileges already deny anon/authenticated.
ALTER TABLE "lesson_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lesson_post_reports" ENABLE ROW LEVEL SECURITY;
