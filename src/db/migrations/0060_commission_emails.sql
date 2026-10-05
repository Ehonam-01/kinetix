ALTER TABLE "commission_events" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
-- Commissions paid before this email existed are marked as already
-- notified: only commissions earned from now on send the "félicitations,
-- nouveau filleul" email.
UPDATE "commission_events" SET "notified_at" = "created_at";
