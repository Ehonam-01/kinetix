CREATE TYPE "public"."member_reward_status" AS ENUM('ELIGIBLE', 'CLAIMED', 'PROCESSING', 'DELIVERED');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('PHYSICAL', 'CASH', 'VOUCHER', 'OTHER');--> statement-breakpoint
CREATE TABLE "member_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"status" "member_reward_status" DEFAULT 'ELIGIBLE' NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"delivery_address" jsonb,
	"tracking_info" text
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level_code" smallint NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"value" integer NOT NULL,
	"reward_type" "reward_type" DEFAULT 'PHYSICAL' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_rewards" ADD CONSTRAINT "member_rewards_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_rewards" ADD CONSTRAINT "member_rewards_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_level_code_levels_code_fk" FOREIGN KEY ("level_code") REFERENCES "public"."levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_rewards_user_reward_unique" ON "member_rewards" USING btree ("user_id","reward_id");--> statement-breakpoint
CREATE INDEX "member_rewards_user_idx" ON "member_rewards" USING btree ("user_id");