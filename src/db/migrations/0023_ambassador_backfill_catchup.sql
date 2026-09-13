-- Re-runs 0022's ambassador_profiles backfill. binary_nodes was empty when
-- 0022 ran (post "remise à zéro complète", see DATABASE.md), so it
-- backfilled 0 rows; a real account has since activated for real (the
-- pre-pivot activate-registration.ts path, still fully functional and
-- untouched) and become the platform's binary root. That account is
-- genuinely already an ambassador in every sense that matters (root
-- position, level 1 unlocked) but has no ambassador_profiles row yet,
-- since it registered through the old path. Idempotent (ON CONFLICT DO
-- NOTHING) and safe to have run twice even if this gap hadn't occurred.
INSERT INTO ambassador_profiles (user_id, status, referral_code, joined_at, terms_accepted_at, terms_version)
SELECT bn.user_id, 'ACTIVE', p.username, bn.placed_at, bn.placed_at, 'legacy-v0'
FROM binary_nodes bn
JOIN profiles p ON p.id = bn.user_id
ON CONFLICT (user_id) DO NOTHING;
