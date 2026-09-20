CREATE TYPE "public"."admin_recharge_request_status" AS ENUM('PENDING_OTP', 'CONFIRMED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "admin_recharge_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficiary_user_id" uuid NOT NULL,
	"requested_by_admin_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text,
	"status" "admin_recharge_request_status" DEFAULT 'PENDING_OTP' NOT NULL,
	"otp_code_hash" text NOT NULL,
	"otp_expires_at" timestamp with time zone NOT NULL,
	"otp_attempts" smallint DEFAULT 0 NOT NULL,
	"financial_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admin_recharge_requests" ADD CONSTRAINT "admin_recharge_requests_beneficiary_user_id_profiles_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_recharge_requests" ADD CONSTRAINT "admin_recharge_requests_requested_by_admin_id_profiles_id_fk" FOREIGN KEY ("requested_by_admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_recharge_requests" ADD CONSTRAINT "admin_recharge_requests_financial_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("financial_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_recharge_requests_beneficiary_idx" ON "admin_recharge_requests" USING btree ("beneficiary_user_id");--> statement-breakpoint
CREATE INDEX "admin_recharge_requests_admin_idx" ON "admin_recharge_requests" USING btree ("requested_by_admin_id");--> statement-breakpoint
CREATE INDEX "admin_recharge_requests_status_idx" ON "admin_recharge_requests" USING btree ("status");