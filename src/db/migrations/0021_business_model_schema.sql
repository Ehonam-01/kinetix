CREATE TYPE "public"."course_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."ambassador_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('CONFIRMED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."commission_calc_type" AS ENUM('FIXED', 'PERCENTAGE', 'BV_PERCENTAGE');--> statement-breakpoint
CREATE TYPE "public"."commission_rule_scope" AS ENUM('DIRECT_SALE', 'GENERATION');--> statement-breakpoint
ALTER TYPE "public"."financial_transaction_type" ADD VALUE 'DIRECT_SALE_COMMISSION';--> statement-breakpoint
ALTER TYPE "public"."financial_transaction_type" ADD VALUE 'GENERATION_COMMISSION';--> statement-breakpoint
ALTER TYPE "public"."financial_transaction_type" ADD VALUE 'COMMISSION_REVERSAL';--> statement-breakpoint
ALTER TYPE "public"."payment_purpose" ADD VALUE 'COURSE_PURCHASE';--> statement-breakpoint
CREATE TABLE "ambassador_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" "ambassador_status" DEFAULT 'ACTIVE' NOT NULL,
	"referral_code" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"terms_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ambassador_user_id" uuid NOT NULL,
	"visitor_token" text NOT NULL,
	"course_id" uuid,
	"landing_path" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"price_paid" integer NOT NULL,
	"business_volume" integer NOT NULL,
	"ambassador_user_id" uuid,
	"attribution_id" uuid,
	"status" "sale_status" DEFAULT 'CONFIRMED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "commission_rule_scope" NOT NULL,
	"course_id" uuid,
	"category" text,
	"level_code" smallint,
	"generation" smallint,
	"commission_type" "commission_calc_type" NOT NULL,
	"rate" integer NOT NULL,
	"cap" integer,
	"minimum_bv" integer,
	"qualification_requirement" jsonb,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"initiated_by_admin_id" uuid NOT NULL,
	"reason" text,
	"access_revoked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_progress" ADD COLUMN "bv_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "business_volume" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "status" "course_status" DEFAULT 'PUBLISHED' NOT NULL;--> statement-breakpoint
ALTER TABLE "ambassador_profiles" ADD CONSTRAINT "ambassador_profiles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_ambassador_user_id_profiles_id_fk" FOREIGN KEY ("ambassador_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_clicks" ADD CONSTRAINT "referral_clicks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_buyer_user_id_profiles_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_ambassador_user_id_profiles_id_fk" FOREIGN KEY ("ambassador_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_attribution_id_referral_clicks_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."referral_clicks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_level_code_levels_code_fk" FOREIGN KEY ("level_code") REFERENCES "public"."levels"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_admin_id_profiles_id_fk" FOREIGN KEY ("initiated_by_admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ambassador_profiles_referral_code_unique" ON "ambassador_profiles" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "referral_clicks_visitor_idx" ON "referral_clicks" USING btree ("visitor_token","clicked_at");--> statement-breakpoint
CREATE INDEX "referral_clicks_ambassador_idx" ON "referral_clicks" USING btree ("ambassador_user_id");--> statement-breakpoint
CREATE INDEX "sales_buyer_idx" ON "sales" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "sales_ambassador_idx" ON "sales" USING btree ("ambassador_user_id");--> statement-breakpoint
CREATE INDEX "sales_course_idx" ON "sales" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "commission_rules_scope_effective_idx" ON "commission_rules" USING btree ("scope","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_slug_unique" ON "courses" USING btree ("slug");