-- 5 fixed levels. Level 1 has 2 generations (G1=2, G2=4, total 6); levels
-- 2-5 have 3 (G1=2, G2=4, G3=8, total 14) — section 9-11 of the master
-- prompt. Names/config are admin-editable later (section 29); this is
-- just the initial seed.
INSERT INTO levels (code, name, config) VALUES
  (1, 'Niveau 1', '{"generationSizes":[2,4]}'),
  (2, 'Niveau 2', '{"generationSizes":[2,4,8]}'),
  (3, 'Niveau 3', '{"generationSizes":[2,4,8]}'),
  (4, 'Niveau 4', '{"generationSizes":[2,4,8]}'),
  (5, 'Niveau 5', '{"generationSizes":[2,4,8]}');

-- Default financial parameters (section 12), versioned from day one.
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('registration_price', 4500),
  ('commission.direct', 500),
  ('commission.level_1_bonus', 1000),
  ('commission.level.2', 2000),
  ('commission.level.3', 3000),
  ('commission.level.4', 20000),
  ('commission.level.5', 50000);

ALTER TABLE "levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generation_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parameter_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_balances" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely.

CREATE POLICY "Levels are public" ON "levels"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view their own level progress" ON "member_levels"
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own generation progress" ON "generation_progress"
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own commission events" ON "commission_events"
  FOR SELECT TO authenticated USING (auth.uid() = beneficiary_user_id);

CREATE POLICY "Users can view their own transactions" ON "financial_transactions"
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own balance" ON "user_balances"
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- parameter_versions holds nothing but commission/pricing configuration —
-- no per-row ownership concept, and it isn't sensitive to expose to any
-- authenticated member (the UI needs it to show upcoming reward/commission
-- values). No policy is added for anonymous/unauthenticated access.
CREATE POLICY "Authenticated users can view parameter versions" ON "parameter_versions"
  FOR SELECT TO authenticated USING (true);
