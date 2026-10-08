CREATE TYPE "public"."orientation_request_status" AS ENUM('NEW', 'HANDLED');--> statement-breakpoint
CREATE TABLE "orientation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal" text NOT NULL,
	"situation" text NOT NULL,
	"level" text NOT NULL,
	"weekly_time" text NOT NULL,
	"interests" text NOT NULL,
	"message" text,
	"status" "orientation_request_status" DEFAULT 'NEW' NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orientation_requests" ADD CONSTRAINT "orientation_requests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orientation_requests" ADD CONSTRAINT "orientation_requests_handled_by_admin_id_profiles_id_fk" FOREIGN KEY ("handled_by_admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orientation_requests_user_idx" ON "orientation_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orientation_requests_status_idx" ON "orientation_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "orientation_requests_one_new_per_user" ON "orientation_requests" USING btree ("user_id") WHERE "orientation_requests"."status" = 'NEW';--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes orientation requests.
ALTER TABLE "orientation_requests" ENABLE ROW LEVEL SECURITY;
