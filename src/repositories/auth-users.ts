import "server-only";
import { sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";

// Batched — used by the admin member list/detail pages
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
