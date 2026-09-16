-- Custom SQL migration file, put your code below! --

-- Same pattern as migration 0025's attribution.cookie_days seed, 0029's
-- withdrawal.minimum_amount, and 0032's bv.value_in_cfa. Explicit user
-- decision (15 000 F CFA / an) — never invented. subscription.business_volume
-- is derived from that price via bv.value_in_cfa (1000): 15000 / 1000 = 15,
-- so the subscription's BV always matches what it's actually worth in F CFA,
-- same principle as every other BV figure in this codebase — never assumed
-- equal to price by coincidence, just computed consistently from the same
-- constant.
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('subscription.price_in_cfa', 15000),
  ('subscription.business_volume', 15);
