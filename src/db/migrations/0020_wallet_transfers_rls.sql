ALTER TABLE "wallet_transfers" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely.

CREATE POLICY "Users can view transfers where they are sender or recipient" ON "wallet_transfers"
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
