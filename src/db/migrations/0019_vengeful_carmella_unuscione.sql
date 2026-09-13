CREATE TYPE "public"."wallet_transfer_status" AS ENUM('PENDING_OTP', 'CONFIRMED', 'EXPIRED');--> statement-breakpoint
ALTER TYPE "public"."financial_transaction_type" ADD VALUE 'TRANSFER_SENT';--> statement-breakpoint
ALTER TYPE "public"."financial_transaction_type" ADD VALUE 'TRANSFER_RECEIVED';--> statement-breakpoint
CREATE TABLE "wallet_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "wallet_transfer_status" DEFAULT 'PENDING_OTP' NOT NULL,
	"otp_code_hash" text NOT NULL,
	"otp_expires_at" timestamp with time zone NOT NULL,
	"otp_attempts" smallint DEFAULT 0 NOT NULL,
	"sender_transaction_id" uuid,
	"recipient_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wallet_transfers" ADD CONSTRAINT "wallet_transfers_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transfers" ADD CONSTRAINT "wallet_transfers_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transfers" ADD CONSTRAINT "wallet_transfers_sender_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("sender_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transfers" ADD CONSTRAINT "wallet_transfers_recipient_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("recipient_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_transfers_sender_idx" ON "wallet_transfers" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "wallet_transfers_recipient_idx" ON "wallet_transfers" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "wallet_transfers_status_idx" ON "wallet_transfers" USING btree ("status");