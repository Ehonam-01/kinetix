ALTER TABLE "workshop_registrations" ADD COLUMN "amount_paid" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Seats paid before payment in parts existed were paid in full.
UPDATE "workshop_registrations" SET "amount_paid" = "amount" WHERE "status" = 'PAID';
