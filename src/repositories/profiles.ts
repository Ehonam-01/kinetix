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

// Used wherever a pseudo needs to resolve to a display name for a live
// preview (registration's sponsor field, wallet transfer's recipient
// field) — never a suspended account, matching what the real action
// (joining under them, transferring to them) would reject anyway.
export async function findActiveProfileByUsername(username: string) {
  const profile = await findProfileByUsername(username);
  if (!profile || profile.status === "SUSPENDED") return null;
  return profile;
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

// Self-service edit of the community-directory fields (dashboard/settings) —
// a separate function from updateProfileFields on purpose: these are a
// distinct concern (how you present yourself to other members) from
// identity fields, edited from their own settings card.
export async function updateCommunityProfileFields(
  userId: string,
  values: { bio: string | null; goal: string | null; skills: string[] },
) {
  const [updated] = await db
    .update(profiles)
    .set(values)
    .where(eq(profiles.id, userId))
    .returning();

  return updated;
}
