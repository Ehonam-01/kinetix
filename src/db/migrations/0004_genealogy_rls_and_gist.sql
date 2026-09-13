-- GiST index for subtree/ancestor queries (<@, @>, nlevel()) — a plain
-- btree index (what drizzle-kit would infer) only helps equality/prefix
-- lookups on ltree, not containment. See ARCHITECTURE.md.
CREATE INDEX "binary_nodes_path_gist_idx" ON "binary_nodes" USING GIST ("path");

ALTER TABLE "sponsorships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "binary_nodes" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely.

CREATE POLICY "Users can view their own sponsorship or people they sponsored" ON "sponsorships"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = sponsor_id);

CREATE POLICY "Users can view their own subtree" ON "binary_nodes"
  FOR SELECT
  TO authenticated
  USING (
    path <@ (SELECT path FROM binary_nodes WHERE user_id = auth.uid())
  );
