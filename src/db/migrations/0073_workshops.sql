CREATE TYPE "public"."workshop_registration_source" AS ENUM('ONLINE', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."workshop_registration_status" AS ENUM('PENDING', 'PAID', 'FAILED');--> statement-breakpoint
ALTER TYPE "public"."payment_purpose" ADD VALUE 'WORKSHOP';--> statement-breakpoint
CREATE TABLE "workshop_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"email" text,
	"city" text NOT NULL,
	"status" "workshop_registration_status" DEFAULT 'PENDING' NOT NULL,
	"source" "workshop_registration_source" DEFAULT 'ONLINE' NOT NULL,
	"amount" integer NOT NULL,
	"payment_id" uuid,
	"access_token" text NOT NULL,
	"discount_code" text,
	"discount_reserved_until" timestamp with time zone,
	"discount_used_at" timestamp with time zone,
	"discount_payment_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_registrations_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "workshop_registrations_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "workshop_registrations_discount_code_unique" UNIQUE("discount_code")
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"price_cfa" integer NOT NULL,
	"regular_price_cfa" integer NOT NULL,
	"capacity" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"venue" text NOT NULL,
	"whatsapp_group_url" text,
	"registrations_open" boolean DEFAULT true NOT NULL,
	"discount_valid_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "beneficiary_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ADD CONSTRAINT "workshop_registrations_discount_payment_id_payments_id_fk" FOREIGN KEY ("discount_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workshop_registrations_workshop_status_idx" ON "workshop_registrations" USING btree ("workshop_id","status");--> statement-breakpoint
CREATE INDEX "workshop_registrations_whatsapp_idx" ON "workshop_registrations" USING btree ("workshop_id","whatsapp");--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes workshops and their participants.
ALTER TABLE "workshops" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "workshop_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- The one workshop: every value here is edited from /admin/atelier.
INSERT INTO "workshops" ("slug", "title", "price_cfa", "regular_price_cfa", "capacity", "starts_at", "ends_at", "venue", "discount_valid_until")
VALUES ('atelier-video-ia', 'Kinetix AI Video Masterclass', 2000, 25000, 50, '2026-11-07T08:00:00Z', '2026-11-07T13:00:00Z', '[adresse précise, Lomé]', '2026-11-07T23:59:59Z');
