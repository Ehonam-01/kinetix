-- Custom SQL migration file, put your code below! --

-- The Level 1 completion bonus is removed from the compensation plan
-- (explicit product decision) — services/mlm/unlock-level.ts's
-- completeLevel no longer reads this parameter at all, so it's genuinely
-- unreachable now, not just unused-by-default. Same precedent as
-- migration 0031's cleanup of the other dormant commission parameters.
DELETE FROM parameter_versions WHERE parameter_key = 'commission.level_1_bonus';

-- Clears the placeholder phone/moto/car catalog seeded in migration 0010
-- (200000/700000/10000000 F) — the real values (including whether the
-- level 5 reward is even a car) aren't decided yet, and no member has
-- unlocked any of them (member_rewards has zero rows referencing these),
-- so this is safe: nothing orphaned. An admin now creates each level's
-- reward from scratch via /admin/levels, name/value/image all blank
-- until set.
DELETE FROM rewards WHERE level_code IN (3, 4, 5);
