ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Defense in depth only (see profiles_rls migration) — application code
-- reads/writes through Drizzle over a direct Postgres connection, which
-- bypasses RLS entirely. No member-facing SELECT policy: audit logs are an
-- admin-only concern, read exclusively through requireAdmin()-gated pages.
