ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only: application code reads/writes profiles through
-- Drizzle over a direct Postgres connection, which bypasses RLS entirely.
-- These policies protect the row if it's ever queried through the
-- Supabase client (anon/authenticated JWT) instead. No write policies are
-- defined, so direct client writes are denied by default — profile writes
-- happen server-side only (src/services/auth).
CREATE POLICY "Users can view own profile" ON "profiles"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
