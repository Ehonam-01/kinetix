-- Custom SQL migration file, put your code below! --

-- A public Supabase Storage bucket for course thumbnails — reuses the
-- existing Supabase project (no new vendor, unlike the deliberate decision
-- to host lesson videos externally, see db/schema/courses.ts) since Storage
-- is already part of the same account as Postgres/Auth. Public read (course
-- cards on the homepage/dashboard need the URL to just work for signed-out
-- visitors); write restricted to admins below.
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Unlike every table policy elsewhere in this project (defense-in-depth
-- only, since app code reads/writes through Drizzle over a direct Postgres
-- connection that bypasses RLS entirely — see SECURITY.md), this one is
-- load-bearing: services/lms/upload-course-thumbnail.ts uploads through the
-- session-authenticated Supabase client (@supabase/ssr), not Drizzle,
-- because Storage objects are files, not rows reachable over the Postgres
-- connection. The service still re-checks the admin role in application
-- code first (same as every other admin service), so this is real
-- defense-in-depth on top of a real check, not the only gate.
CREATE POLICY "Anyone can view course thumbnails" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'course-thumbnails');

CREATE POLICY "Admins can upload course thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-thumbnails'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can replace course thumbnails" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-thumbnails'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete course thumbnails" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-thumbnails'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );