import "server-only";
import { and, desc, eq, ilike, notInArray, or } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";

export type CommunityMember = {
  id: string;
  fullName: string;
  username: string;
  country: string | null;
  bio: string | null;
  goal: string | null;
  skills: string[] | null;
};

const DIRECTORY_LIMIT = 60;

// The member directory (dashboard/community) — open to any non-suspended,
// non-deleted member who hasn't opted out (directoryVisible), same gate as
// every other "plain customer" surface in this app (dashboard/courses,
// hasCourseAccess's admin bypass aside): Community is explicitly a
// discovery space, not a paid perk, so requiring ACTIVE (a subscription or
// the ambassador program) here would silently exclude someone who just
// signed up and filled in their community profile — caught live while
// verifying this feature: a fresh PENDING_PAYMENT member could edit their
// profile but would never show up anywhere. DELETED is excluded for a
// different reason: confirm-account-deletion.ts wipes bio/goal/skills but
// the row itself is never removed (see db/schema/profiles.ts), so without
// this it would show up as an empty "Compte supprimé" ghost entry.
// No pagination yet (capped at DIRECTORY_LIMIT) — the real member count is
// tiny today; add real pagination once that stops being true.
export async function listCommunityMembers(
  executor: Executor,
  input: { search?: string; goal?: string } = {},
): Promise<CommunityMember[]> {
  const conditions = [
    notInArray(profiles.status, ["SUSPENDED", "DELETED"]),
    eq(profiles.directoryVisible, true),
  ];

  if (input.search) {
    const term = `%${input.search}%`;
    conditions.push(
      or(ilike(profiles.fullName, term), ilike(profiles.username, term))!,
    );
  }
  if (input.goal) {
    conditions.push(eq(profiles.goal, input.goal));
  }

  return executor.query.profiles.findMany({
    where: and(...conditions),
    orderBy: desc(profiles.createdAt),
    limit: DIRECTORY_LIMIT,
    columns: {
      id: true,
      fullName: true,
      username: true,
      country: true,
      bio: true,
      goal: true,
      skills: true,
    },
  });
}
