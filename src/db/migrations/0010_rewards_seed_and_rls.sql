-- Default rewards (section 16), admin-editable later (section 29).
INSERT INTO rewards (level_code, name, description, value, reward_type) VALUES
  (3, 'Téléphone', 'Récompense de fin de niveau 3', 200000, 'PHYSICAL'),
  (4, 'Moto', 'Récompense de fin de niveau 4', 700000, 'PHYSICAL'),
  (5, 'Voiture', 'Récompense de fin de niveau 5', 10000000, 'PHYSICAL');

ALTER TABLE "rewards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_rewards" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely.

CREATE POLICY "Rewards catalog is public" ON "rewards"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view their own rewards" ON "member_rewards"
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
