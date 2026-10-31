-- The participants' code is handed out after the workshop (14 November):
-- it stays usable until the end of the next day. Lomé is on UTC.
UPDATE "workshops"
SET "discount_valid_until" = '2026-11-15T23:59:59Z', "updated_at" = now()
WHERE "slug" = 'atelier-video-ia';
