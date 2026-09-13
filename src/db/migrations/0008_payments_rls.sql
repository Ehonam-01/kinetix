ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely.

CREATE POLICY "Users can view payments where they are beneficiary or payer" ON "payments"
  FOR SELECT TO authenticated
  USING (auth.uid() = beneficiary_user_id OR auth.uid() = payer_user_id);

-- payment_events is a raw webhook audit log with no per-row ownership
-- concept and no user-facing purpose — no policy is added, so it stays
-- inaccessible to the authenticated/anon roles (RLS default-denies).
