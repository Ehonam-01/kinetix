-- Custom SQL migration file, put your code below! --

-- Security audit M5. These 17 tables were created by earlier migrations
-- without ENABLE ROW LEVEL SECURITY. Production already has RLS on every
-- table (Supabase's rls_auto_enable event trigger turned it on as each was
-- created) and no data privileges for anon/authenticated — so this is a
-- no-op there. What it fixes is any environment rebuilt from these
-- migrations alone (staging, disaster recovery, a new Supabase project),
-- where these tables would otherwise be readable/writable by every
-- signed-in user through the public Data API: commission_rules,
-- subscriptions, account_deletion_requests, OTP hashes...
--
-- No policies added: nothing in the app reaches these tables as
-- anon/authenticated (every read/write goes through Drizzle's direct
-- Postgres connection), so RLS with no policy = deny-all, exactly right.
ALTER TABLE "account_deletion_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_recharge_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ambassador_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "commission_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mentor_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mentor_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mentorships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quiz_questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "referral_clicks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscription_wallet_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Production still grants REFERENCES, TRIGGER and TRUNCATE on every public
-- table to anon/authenticated — TRUNCATE isn't subject to RLS at all. Not
-- reachable through PostgREST, but nothing needs them: storage policies
-- check admin rights through public.is_admin() (SECURITY DEFINER,
-- migration 0050), which doesn't depend on the caller's table grants.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
