"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { approveMentorRequest } from "@/services/admin/approve-mentor-request";
import { rejectMentorRequest } from "@/services/admin/reject-mentor-request";

export async function approveMentorRequestAction(mentorProfileId: string) {
  const { profile } = await requireAdmin();
  try {
    await approveMentorRequest(profile.id, mentorProfileId);
    revalidatePath("/admin/mentors");
    revalidatePath("/dashboard/mentors");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function rejectMentorRequestAction(
  mentorProfileId: string,
  reason: string,
) {
  const { profile } = await requireAdmin();
  try {
    await rejectMentorRequest(profile.id, mentorProfileId, reason);
    revalidatePath("/admin/mentors");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
