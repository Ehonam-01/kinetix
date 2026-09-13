import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";

// auth.users is Supabase-managed, not part of our Drizzle schema (see
// src/db/schema/profiles.ts) — read-only raw SQL is the simplest correct
// way to resolve an email to an id without duplicating that table.
export async function findAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id FROM auth.users WHERE lower(email) = lower(${email}) LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

// Reverse direction, batched — used by the admin member list/detail pages
// to display an email next to a profile without duplicating it in
// `profiles`.
export async function listAuthEmails(
  executor: Executor,
  userIds: string[],
): Promise<{ id: string; email: string | null }[]> {
  if (userIds.length === 0) return [];
  return executor.execute<{ id: string; email: string | null }>(
    sql`SELECT id, email FROM auth.users WHERE id IN ${userIds}`,
  );
}

export async function findAuthEmailByUserId(
  executor: Executor,
  userId: string,
): Promise<string | null> {
  const rows = await listAuthEmails(executor, [userId]);
  return rows[0]?.email ?? null;
}
