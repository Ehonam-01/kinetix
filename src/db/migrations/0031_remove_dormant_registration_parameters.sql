-- Custom SQL migration file, put your code below! --

-- Removes the flat parameters left over from the paid-registration flow
-- retired by the education-first pivot (MLM_RULES.md, "Pivot formation +
-- programme ambassadeur"). Confirmed unreachable before deleting, not just
-- assumed: no UI calls grantAdminCredit/payRegistrationFromWallet/
-- initiateRegistrationPayment anymore (services/payments/*.ts), the one
-- REGISTRATION payment row in production is already CONFIRMED (a no-op if
-- ever replayed), commission_events has zero rows, and commission_rules now
-- covers every (level, generation) pair so the flat commission.level.N
-- fallback branch in services/mlm/unlock-level.ts can never be reached.
--
-- commission.level_1_bonus is deliberately NOT included: unlike the other
-- level parameters, unlock-level.ts's completeLevel reads it
-- unconditionally whenever any member's level 1 completes (not gated
-- behind "no commission_rules row exists"), so it stays live under the new
-- free ambassador-join flow too.
DELETE FROM parameter_versions
WHERE parameter_key IN (
  'registration_price',
  'commission.direct',
  'commission.level.2',
  'commission.level.3',
  'commission.level.4',
  'commission.level.5'
);