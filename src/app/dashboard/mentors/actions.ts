"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { requestMentorship } from "@/services/mentorship/request-mentorship";
import { submitMentorReview } from "@/services/mentorship/submit-mentor-review";
import { submitMentorReviewSchema } from "@/schemas/mentor-review";

export async function requestMentorshipAction(mentorUserId: string) {
  const { profile } = await requireUser();
  try {
    await requestMentorship(profile.id, mentorUserId);
    revalidatePath("/dashboard/mentors");
    revalidatePath("/dashboard/become-mentor");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function submitMentorReviewAction(input: {
  mentorshipId: string;
  rating: number;
  comment?: string;
}) {
  const { profile } = await requireUser();
  const parsed = submitMentorReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }

  try {
    await submitMentorReview(
      profile.id,
      parsed.data.mentorshipId,
      parsed.data.rating,
      parsed.data.comment,
    );
    revalidatePath("/dashboard/mentors");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
