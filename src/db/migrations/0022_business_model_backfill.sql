-- Derives a slug for any existing course left NULL by migration 0021
-- (simple slugify: lowercase, non-alphanumeric runs -> single dash, no
-- leading/trailing dash). Only one seeded course exists today
-- ("Bienvenue dans le programme" -> "bienvenue-dans-le-programme"), so
-- collision handling beyond the unique index itself is not needed yet.
UPDATE courses
SET slug = trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
--> statement-breakpoint

-- Grandfathers in any ambassador who was already placed in the binary tree
-- before ambassador_profiles existed (compatibilité, section 28 of the
-- master prompt) — a no-op today (binary_nodes is empty post-remise-à-zéro,
-- see DATABASE.md), but correct for whenever this runs against a populated
-- tree. referral_code reuses the already-unique username. joined_at/
-- terms_accepted_at both fall back to placed_at: these members were
-- already effectively in the program before any CGU concept existed, so
-- backdating rather than defaulting to "now" keeps joined_at meaningful.
INSERT INTO ambassador_profiles (user_id, status, referral_code, joined_at, terms_accepted_at, terms_version)
SELECT bn.user_id, 'ACTIVE', p.username, bn.placed_at, bn.placed_at, 'legacy-v0'
FROM binary_nodes bn
JOIN profiles p ON p.id = bn.user_id
ON CONFLICT (user_id) DO NOTHING;
