-- Custom SQL migration file, put your code below! --

-- Fixes "permission denied for table profiles" on reward/course image
-- uploads (migrations 0030, 0041): their storage.objects policies each ran
-- `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')`
-- directly as the `authenticated` role, which never had a table-level GRANT
-- on profiles (profiles.ts's own RLS policy is SELECT-only and defense in
-- depth — see migration 0002's comment: real app reads go through Drizzle's
-- direct Postgres connection, which bypasses grants and RLS alike, so
-- nothing until now ever exercised this path as `authenticated`). A
-- SECURITY DEFINER function is the standard Postgres/Supabase fix: it runs
-- with its owner's privileges (whoever ran this migration, the same role
-- that already owns/can read profiles), regardless of the calling role's
-- own grants.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Admins can upload course thumbnails" ON storage.objects;
CREATE POLICY "Admins can upload course thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can replace course thumbnails" ON storage.objects;
CREATE POLICY "Admins can replace course thumbnails" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete course thumbnails" ON storage.objects;
CREATE POLICY "Admins can delete course thumbnails" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-thumbnails' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can upload reward images" ON storage.objects;
CREATE POLICY "Admins can upload reward images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reward-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can replace reward images" ON storage.objects;
CREATE POLICY "Admins can replace reward images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'reward-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete reward images" ON storage.objects;
CREATE POLICY "Admins can delete reward images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reward-images' AND public.is_admin());
