ALTER TABLE "member_levels" ADD COLUMN "certificate_emailed_at" timestamp with time zone;--> statement-breakpoint
-- Levels completed before this email existed are marked as already
-- notified: only levels completed from now on send the "niveau complété,
-- votre certificat est prêt" email.
UPDATE "member_levels" SET "certificate_emailed_at" = "completed_at" WHERE "status" = 'COMPLETED';
