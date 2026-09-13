CREATE TYPE "public"."course_purchase_wallet_status" AS ENUM('PENDING_OTP', 'CONFIRMED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "course_purchase_wallet_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"wallet_user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"ambassador_user_id" uuid,
	"attribution_id" uuid,
	"status" "course_purchase_wallet_status" DEFAULT 'PENDING_OTP' NOT NULL,
	"otp_code_hash" text NOT NULL,
	"otp_expires_at" timestamp with time zone NOT NULL,
	"otp_attempts" smallint DEFAULT 0 NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "course_purchase_wallet_requests" ADD CONSTRAINT "course_purchase_wallet_requests_buyer_user_id_profiles_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase_wallet_requests" ADD CONSTRAINT "course_purchase_wallet_requests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase_wallet_requests" ADD CONSTRAINT "course_purchase_wallet_requests_wallet_user_id_profiles_id_fk" FOREIGN KEY ("wallet_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase_wallet_requests" ADD CONSTRAINT "course_purchase_wallet_requests_ambassador_user_id_profiles_id_fk" FOREIGN KEY ("ambassador_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase_wallet_requests" ADD CONSTRAINT "course_purchase_wallet_requests_attribution_id_referral_clicks_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."referral_clicks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_purchase_wallet_requests" ADD CONSTRAINT "course_purchase_wallet_requests_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_purchase_wallet_requests_buyer_idx" ON "course_purchase_wallet_requests" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "course_purchase_wallet_requests_wallet_idx" ON "course_purchase_wallet_requests" USING btree ("wallet_user_id");--> statement-breakpoint
CREATE INDEX "course_purchase_wallet_requests_status_idx" ON "course_purchase_wallet_requests" USING btree ("status");