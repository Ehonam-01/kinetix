CREATE TYPE "public"."member_level_status" AS ENUM('IN_PROGRESS', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('PENDING', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('DIRECT', 'LEVEL_1_BONUS', 'LEVEL_COMMISSION');--> statement-breakpoint
CREATE TYPE "public"."financial_transaction_status" AS ENUM('PENDING', 'COMPLETED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."financial_transaction_type" AS ENUM('DIRECT_COMMISSION', 'LEVEL_1_BONUS', 'LEVEL_COMMISSION', 'REWARD', 'PAYMENT', 'REFUND', 'WITHDRAWAL', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "levels" (
	"code" smallint PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level_code" smallint NOT NULL,
	"status" "member_level_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generation_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"level_code" smallint NOT NULL,
	"generation" smallint NOT NULL,
	"required_count" smallint NOT NULL,
	"current_count" smallint DEFAULT 0 NOT NULL,
	"status" "generation_status" DEFAULT 'PENDING' NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "parameter_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parameter_key" text NOT NULL,
	"value" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"source_user_id" uuid,
	"type" "commission_type" NOT NULL,
	"level_code" smallint,
	"generation" smallint,
	"amount" integer NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_events_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "financial_transaction_type" NOT NULL,
	"amount" integer NOT NULL,
	"status" "financial_transaction_status" DEFAULT 'COMPLETED' NOT NULL,
	"reference" text NOT NULL,
	"related_level" smallint,
	"related_generation" smallint,
	"commission_event_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_transactions_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "user_balances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"available_balance" integer DEFAULT 0 NOT NULL,
	"pending_balance" integer DEFAULT 0 NOT NULL,
	"withdrawn_balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earnings" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_levels" ADD CONSTRAINT "member_levels_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_levels" ADD CONSTRAINT "member_levels_level_code_levels_code_fk" FOREIGN KEY ("level_code") REFERENCES "public"."levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_progress" ADD CONSTRAINT "generation_progress_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_progress" ADD CONSTRAINT "generation_progress_level_code_levels_code_fk" FOREIGN KEY ("level_code") REFERENCES "public"."levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parameter_versions" ADD CONSTRAINT "parameter_versions_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_beneficiary_user_id_profiles_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_source_user_id_profiles_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_level_code_levels_code_fk" FOREIGN KEY ("level_code") REFERENCES "public"."levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_commission_event_id_commission_events_id_fk" FOREIGN KEY ("commission_event_id") REFERENCES "public"."commission_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_levels_user_level_unique" ON "member_levels" USING btree ("user_id","level_code");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_progress_user_level_gen_unique" ON "generation_progress" USING btree ("user_id","level_code","generation");--> statement-breakpoint
CREATE INDEX "parameter_versions_key_effective_idx" ON "parameter_versions" USING btree ("parameter_key","effective_from");--> statement-breakpoint
CREATE INDEX "commission_events_beneficiary_idx" ON "commission_events" USING btree ("beneficiary_user_id","created_at");--> statement-breakpoint
CREATE INDEX "financial_transactions_user_created_idx" ON "financial_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "financial_transactions_type_idx" ON "financial_transactions" USING btree ("type");