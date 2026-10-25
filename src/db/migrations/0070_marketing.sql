CREATE TABLE "marketing_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"meta_pixel_id" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_token" uuid NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"referrer_host" text,
	"landing_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signup_sources" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"visit_id" uuid,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"referrer_host" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketing_settings" ADD CONSTRAINT "marketing_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_sources" ADD CONSTRAINT "signup_sources_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_sources" ADD CONSTRAINT "signup_sources_visit_id_marketing_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."marketing_visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marketing_visits_created_idx" ON "marketing_visits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "marketing_visits_token_idx" ON "marketing_visits" USING btree ("visitor_token");--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes these.
ALTER TABLE "marketing_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "marketing_visits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "signup_sources" ENABLE ROW LEVEL SECURITY;
