CREATE TABLE "course_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"hidden_at" timestamp with time zone,
	"hidden_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_reviews_rating_range" CHECK ("course_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_reviews" ADD CONSTRAINT "course_reviews_hidden_by_profiles_id_fk" FOREIGN KEY ("hidden_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_reviews_one_per_member" ON "course_reviews" USING btree ("course_id","user_id");--> statement-breakpoint
CREATE INDEX "course_reviews_course_idx" ON "course_reviews" USING btree ("course_id");--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes course reviews.
ALTER TABLE "course_reviews" ENABLE ROW LEVEL SECURITY;
