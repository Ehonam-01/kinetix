-- Custom SQL migration file, put your code below! --

-- A public Supabase Storage bucket for the level 3-5 reward catalog's
-- pictures (see db/schema/rewards.ts's image_url) — same reasoning and
-- exact same shape as course-thumbnails (migration 0030): public read so
-- the picture just works for signed-out visitors and dashboard members
-- alike, write restricted to admins.
INSERT INTO storage.buckets (id, name, public)
VALUES ('reward-images', 'reward-images', true)
ON CONFLICT (id) DO NOTHING;

-- Load-bearing, not defense-in-depth (same as course-thumbnails' policies):
-- services/admin/upload-reward-image.ts uploads through the
-- session-authenticated Supabase client (@supabase/ssr), not Drizzle,
-- because Storage objects are files, not rows reachable over the Postgres
-- connection. The service still re-checks the admin role in application
-- code first, same as every other admin service.
CREATE POLICY "Anyone can view reward images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'reward-images');

CREATE POLICY "Admins can upload reward images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reward-images'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can replace reward images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'reward-images'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete reward images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'reward-images'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );
