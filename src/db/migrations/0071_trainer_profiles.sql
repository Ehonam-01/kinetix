CREATE TYPE "public"."trainer_request_status" AS ENUM('PENDING_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "trainer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"course_title" text NOT NULL,
	"course_outline" text NOT NULL,
	"experience" text NOT NULL,
	"sample_url" text,
	"status" "trainer_request_status" DEFAULT 'PENDING_REVIEW' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	CONSTRAINT "trainer_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trainer_profiles" ADD CONSTRAINT "trainer_profiles_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes trainer applications.
ALTER TABLE "trainer_profiles" ENABLE ROW LEVEL SECURITY;
