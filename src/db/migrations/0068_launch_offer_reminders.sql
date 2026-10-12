CREATE TABLE "launch_offer_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"days_left" integer NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launch_offer_reminders" ADD CONSTRAINT "launch_offer_reminders_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "launch_offer_reminders_once" ON "launch_offer_reminders" USING btree ("user_id","deadline","days_left");--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes these.
ALTER TABLE "launch_offer_reminders" ENABLE ROW LEVEL SECURITY;
