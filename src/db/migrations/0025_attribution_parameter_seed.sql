-- Same pattern as migration 0006's parameter_versions seed. 30 days is a
-- reasonable default (a common affiliate-cookie window), not a value
-- specified anywhere in the master prompt — admin-editable like every
-- other parameter, see admin/parameters/page.tsx.
INSERT INTO parameter_versions (parameter_key, value) VALUES
  ('attribution.cookie_days', 30);
