CREATE TABLE "site_testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"city" text,
	"course_title" text,
	"quote" text NOT NULL,
	"photo_url" text,
	"video_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "site_testimonials_position_idx" ON "site_testimonials" USING btree ("position");--> statement-breakpoint
-- Read and written only by the server (Drizzle, service role): no policy,
-- so the public Supabase API sees nothing (same as every other table).
ALTER TABLE "site_testimonials" ENABLE ROW LEVEL SECURITY;
