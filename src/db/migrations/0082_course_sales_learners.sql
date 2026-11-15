CREATE TYPE "public"."profile_account_type" AS ENUM('MEMBER', 'LEARNER');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "account_type" "profile_account_type" DEFAULT 'MEMBER' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "sale_price" integer;