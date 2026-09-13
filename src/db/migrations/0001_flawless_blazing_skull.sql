CREATE TYPE "public"."profile_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('PENDING_PAYMENT', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
-- auth.users already exists (managed by Supabase Auth) — intentionally not
-- created here. src/db/schema/profiles.ts declares a shadow table only so
-- Drizzle can type the FK; the CREATE TABLE drizzle-kit generated for it
-- was removed from this migration by hand.
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"country" text,
	"role" "profile_role" DEFAULT 'USER' NOT NULL,
	"status" "profile_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;