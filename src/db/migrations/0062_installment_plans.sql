CREATE TYPE "public"."installment_plan_status" AS ENUM('OPEN', 'COMPLETED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."payment_purpose" ADD VALUE 'INSTALLMENT';--> statement-breakpoint
CREATE TABLE "installment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"target_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"status" "installment_plan_status" DEFAULT 'OPEN' NOT NULL,
	"ambassador_user_id" uuid,
	"attribution_id" uuid,
	"first_deposit_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"subscription_payment_id" uuid,
	"expired_at" timestamp with time zone,
	"refund_amount" integer,
	"refund_fee" integer,
	"refund_payout" jsonb,
	"refunded_at" timestamp with time zone,
	"refunded_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_ambassador_user_id_profiles_id_fk" FOREIGN KEY ("ambassador_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_attribution_id_referral_clicks_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."referral_clicks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_subscription_payment_id_payments_id_fk" FOREIGN KEY ("subscription_payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_refunded_by_admin_id_profiles_id_fk" FOREIGN KEY ("refunded_by_admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "installment_plans_user_idx" ON "installment_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "installment_plans_status_idx" ON "installment_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "installment_plans_one_open_per_user" ON "installment_plans" USING btree ("user_id") WHERE "installment_plans"."status" = 'OPEN';--> statement-breakpoint
-- RLS on with no policy, like every table: only the server (which bypasses
-- RLS) reads and writes installment plans.
ALTER TABLE "installment_plans" ENABLE ROW LEVEL SECURITY;
