ALTER TABLE "workshops" ADD COLUMN "page_id" uuid;--> statement-breakpoint
ALTER TABLE "workshops" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_page_id_workshops_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."workshops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "workshops" SET "city" = 'Lomé' WHERE "slug" = 'atelier-video-ia';--> statement-breakpoint
-- The same workshop in three cities (explicit user decision), sold on the
-- page above. Price, struck-through price and seats copied from it, then set
-- per city from /admin/atelier; Kara's and Notsé's places are filled in there.
-- Times in Lomé time (UTC). The code stays usable until the next day's end.
INSERT INTO "workshops" ("slug", "title", "page_id", "city", "price_cfa", "regular_price_cfa", "capacity", "starts_at", "ends_at", "venue", "discount_valid_until")
SELECT s.slug, p."title", p."id", s.city, p."price_cfa", p."regular_price_cfa", p."capacity", s.starts_at::timestamptz, s.ends_at::timestamptz, s.venue, s.valid_until::timestamptz
FROM "workshops" p
CROSS JOIN (VALUES
  ('atelier-video-ia-lome-2026-11-28', 'Lomé', '2026-11-28T08:00:00Z', '2026-11-28T12:00:00Z', 'Adidogomé franciscain, Hôtel Marguo City, Lomé', '2026-11-29T23:59:59Z'),
  ('atelier-video-ia-kara-2026-12-05', 'Kara', '2026-12-05T08:00:00Z', '2026-12-05T12:00:00Z', '', '2026-12-06T23:59:59Z'),
  ('atelier-video-ia-notse-2026-12-06', 'Notsé', '2026-12-06T14:00:00Z', '2026-12-06T18:00:00Z', '', '2026-12-07T23:59:59Z')
) AS s(slug, city, starts_at, ends_at, venue, valid_until)
WHERE p."slug" = 'atelier-video-ia'
ON CONFLICT ("slug") DO NOTHING;
