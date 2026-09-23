import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { mentorProfiles } from "@/db/schema/mentor-profiles";
import { profiles } from "@/db/schema/profiles";

export function findMentorProfileByUserId(executor: Executor, userId: string) {
  return executor.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, userId),
  });
}

export type AdminMentorRequest = {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  category: string;
  pitch: string | null;
  requestedAt: Date;
};

const ADMIN_MENTOR_REQUEST_COLUMNS = {
  id: mentorProfiles.id,
  userId: mentorProfiles.userId,
  username: profiles.username,
  fullName: profiles.fullName,
  category: mentorProfiles.category,
  pitch: mentorProfiles.pitch,
  requestedAt: mentorProfiles.requestedAt,
};

// Admin review queue — oldest request first, same "nothing gets buried
// behind newer ones" convention as listPendingWithdrawalRequestsForAdmin.
export function listPendingMentorRequestsForAdmin(
  executor: Executor,
): Promise<AdminMentorRequest[]> {
  return executor
    .select(ADMIN_MENTOR_REQUEST_COLUMNS)
    .from(mentorProfiles)
    .innerJoin(profiles, eq(profiles.id, mentorProfiles.userId))
    .where(eq(mentorProfiles.status, "PENDING_REVIEW"))
    .orderBy(asc(mentorProfiles.requestedAt));
}

export type DirectoryMentor = {
  userId: string;
  username: string;
  fullName: string;
  country: string | null;
  bio: string | null;
  category: string;
  pitch: string | null;
};

const DIRECTORY_MENTOR_COLUMNS = {
  userId: mentorProfiles.userId,
  username: profiles.username,
  fullName: profiles.fullName,
  country: profiles.country,
  bio: profiles.bio,
  category: mentorProfiles.category,
  pitch: mentorProfiles.pitch,
};

// dashboard/mentors — every APPROVED mentor, optionally scoped to one
// domain. No directoryVisible gate unlike listCommunityMembers: becoming a
// mentor is itself an opt-in, explicit request (services/mentorship/
// request-mentor-status.ts) validated by an admin, a stronger signal of
// intent to be found than the community directory's default-on visibility.
export function listApprovedMentors(
  executor: Executor,
  input: { category?: string } = {},
): Promise<DirectoryMentor[]> {
  const conditions = [eq(mentorProfiles.status, "APPROVED")];
  if (input.category) {
    conditions.push(eq(mentorProfiles.category, input.category));
  }

  return executor
    .select(DIRECTORY_MENTOR_COLUMNS)
    .from(mentorProfiles)
    .innerJoin(profiles, eq(profiles.id, mentorProfiles.userId))
    .where(and(...conditions))
    .orderBy(desc(mentorProfiles.reviewedAt));
}

// dashboard/mentors' filter dropdown — the domains actually declared by
// approved mentors (free text, no fixed taxonomy), not courses.category.
export async function listDistinctMentorCategories(
  executor: Executor,
): Promise<string[]> {
  const rows = await executor
    .selectDistinct({ category: mentorProfiles.category })
    .from(mentorProfiles)
    .where(eq(mentorProfiles.status, "APPROVED"))
    .orderBy(asc(mentorProfiles.category));
  return rows.map((r) => r.category);
}
