-- Demo course used by the Phase 7 live-verification script, gated to level 1
-- (any member who has unlocked level 1 — i.e. every active member — sees it).
INSERT INTO courses (id, title, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Bienvenue dans le programme', 'Introduction au fonctionnement de la plateforme');

INSERT INTO course_levels (course_id, level_code) VALUES
  ('00000000-0000-0000-0000-000000000001', 1);

INSERT INTO modules (id, course_id, title, position) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Prise en main', 1);

INSERT INTO lessons (module_id, title, video_provider, video_url, position) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Comment fonctionne le plan de compensation', 'YOUTUBE', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1),
  ('00000000-0000-0000-0000-000000000002', 'Votre premier parrainage', 'YOUTUBE', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 2);

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "course_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lesson_progress" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely. Real access control (level gating) lives in
-- repositories/courses.ts, not in these policies.

CREATE POLICY "Course catalog is public" ON "courses"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Course level requirements are public" ON "course_levels"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Modules are public" ON "modules"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Lessons are public" ON "lessons"
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view their own lesson progress" ON "lesson_progress"
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
