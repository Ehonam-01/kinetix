-- Custom SQL migration file, put your code below! --

-- Same pattern as migration 0025's attribution.cookie_days seed and 0029's
-- withdrawal.minimum_amount. Defines what 1 BV point is worth in F CFA —
-- explicit user decision, not a value from the master prompt. Consumed by
-- computeGenerationCommission/computeDirectSaleCommission
-- (repositories/commission-rules.ts) wherever a BV_PERCENTAGE rule converts
-- accumulated Business Volume into an actual F CFA commission — see
-- ARCHITECTURE.md for why this matters (courses.business_volume is being
-- rescaled in the same change from "equal to price" to real BV points).
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('bv.value_in_cfa', 1000);