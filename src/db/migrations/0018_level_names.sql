-- Thematic rank names (section 29: admin-editable later, not hardcoded in
-- the engine) — replaces the generic "Niveau N" placeholder used since the
-- Phase 4 seed.
UPDATE levels SET name = 'Bronze' WHERE code = 1;
UPDATE levels SET name = 'Argent' WHERE code = 2;
UPDATE levels SET name = 'Or' WHERE code = 3;
UPDATE levels SET name = 'Platine' WHERE code = 4;
UPDATE levels SET name = 'Diamant' WHERE code = 5;
