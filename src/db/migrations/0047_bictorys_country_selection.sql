CREATE TYPE "public"."bictorys_country" AS ENUM('SN', 'CI', 'BJ', 'BF', 'ML', 'TG');--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD COLUMN "country" "bictorys_country";