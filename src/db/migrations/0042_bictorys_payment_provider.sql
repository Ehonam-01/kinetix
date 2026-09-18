CREATE TYPE "public"."mobile_money_operator" AS ENUM('MTN_MONEY', 'ORANGE_MONEY', 'WAVE_MONEY', 'MOOV_MONEY', 'MOBICASH', 'TOGOCELL', 'FREE_MONEY');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('MONEROO', 'BICTORYS');--> statement-breakpoint
ALTER TYPE "public"."withdrawal_request_status" ADD VALUE 'PROCESSING' BEFORE 'PAID';--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"active_provider" "payment_provider" DEFAULT 'MONEROO' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD COLUMN "operator" "mobile_money_operator";--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD COLUMN "payout_provider_reference" text;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD COLUMN "payout_failure_reason" text;--> statement-breakpoint
ALTER TABLE "payment_settings" ADD CONSTRAINT "payment_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;