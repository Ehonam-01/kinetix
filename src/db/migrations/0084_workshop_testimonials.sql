CREATE TYPE "public"."workshop_testimonial_kind" AS ENUM('TEXT', 'IMAGE');--> statement-breakpoint
CREATE TABLE "workshop_testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"kind" "workshop_testimonial_kind" NOT NULL,
	"author_name" text,
	"author_detail" text,
	"body" text,
	"image_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workshop_testimonials" ADD CONSTRAINT "workshop_testimonials_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workshop_testimonials_workshop_idx" ON "workshop_testimonials" USING btree ("workshop_id","position");--> statement-breakpoint
-- Same as every table here: the app reads and writes over its own Postgres
-- connection; nothing is reachable through the public Supabase API.
ALTER TABLE "workshop_testimonials" ENABLE ROW LEVEL SECURITY;
