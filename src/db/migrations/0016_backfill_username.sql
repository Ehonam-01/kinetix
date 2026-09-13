-- Backfills any profile created before the username column existed.
-- Deterministic from the row's own id, so uniqueness is free.
UPDATE profiles
SET username = 'membre_' || substr(id::text, 1, 8)
WHERE username IS NULL;
