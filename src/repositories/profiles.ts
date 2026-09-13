import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";

export function findProfileById(id: string) {
  return db.query.profiles.findFirst({ where: eq(profiles.id, id) });
}

export function findProfileByUsername(username: string) {
  return db.query.profiles.findFirst({
    where: eq(profiles.username, username),
  });
}

export async function insertProfileIfMissing(values: {
  id: string;
  fullName: string;
  username: string;
}) {
  // Availability was already checked at registration time
  // (services/auth/register.ts), but profile creation is deferred until
  // email confirmation (ensure-profile.ts) — minutes can pass, during which
  // someone else could take the same username. Falling back to a suffixed
  // variant keeps signup from hard-failing on that rare race, rather than
  // building a full retry-with-backoff for it.
  let username = values.username;
  if (await findProfileByUsername(username)) {
    username = `${username}_${values.id.slice(0, 4)}`;
  }

  const [created] = await db
    .insert(profiles)
    .values({ ...values, username })
    .onConflictDoNothing({ target: profiles.id })
    .returning();

  return created ?? findProfileById(values.id);
}

// Self-service edit (dashboard/settings) — deliberately narrow: role and
// status are admin-controlled elsewhere (services/admin/set-member-status.ts
// etc.) and never touched here.
export async function updateProfileFields(
  userId: string,
  values: {
    fullName: string;
    username: string;
    phone: string | null;
    country: string | null;
  },
) {
  const [updated] = await db
    .update(profiles)
    .set(values)
    .where(eq(profiles.id, userId))
    .returning();

  return updated;
}
