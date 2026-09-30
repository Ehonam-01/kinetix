-- Custom SQL migration file, put your code below! --

-- The compensation plan stops at level 4 (explicit user decision, costed
-- with lib/compensation-model.ts: 11 generations deep instead of 14).
-- Level 5 is deactivated, not deleted — the same keep-then-remove-later
-- discipline as every other retired mechanism here: its row, its
-- commission_rules and its rewards stay in place, just unreachable, since
-- the engine now treats the highest ACTIVE level as the top of the plan
-- (services/mlm/unlock-level.ts). Going back to 5 levels is
-- `UPDATE levels SET is_active = true WHERE code = 5;`.
UPDATE levels SET is_active = false WHERE code = 5;

-- Completing the top level makes a member an "ancêtre" (no commission of
-- any kind afterwards — services/mlm/commission.ts). Anyone who had
-- already completed level 4 under the 5-level plan gets the same status,
-- dated from that completion, so the rule is the same for everyone.
UPDATE profiles AS p
SET became_ancestor_at = ml.completed_at
FROM member_levels AS ml
WHERE ml.user_id = p.id
  AND ml.level_code = 4
  AND ml.status = 'COMPLETED'
  AND p.became_ancestor_at IS NULL;
