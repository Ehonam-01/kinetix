-- Custom SQL migration file, put your code below! --

-- Same pattern as migration 0025's attribution.cookie_days seed. 2 000 F is
-- a reasonable default (roughly the smallest commission increments already
-- in the system), not a value specified anywhere in the master prompt —
-- admin-editable like every other parameter, see admin/parameters/page.tsx.
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('withdrawal.minimum_amount', 2000);