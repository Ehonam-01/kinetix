ALTER TABLE "withdrawal_requests" ADD COLUMN "fee_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Withdrawal fee settings, edited by the admin from /admin/parameters
-- (versioned and non-retroactive like every parameter_versions row). Both
-- start at 0: no fee until the admin sets one. fee_percent_bp is in basis
-- points of the amount withdrawn (150 = 1,5 %), fee_fixed in F CFA; the
-- fee is their sum (lib/withdrawal-fee.ts).
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('withdrawal.fee_percent_bp', 0),
  ('withdrawal.fee_fixed', 0);
