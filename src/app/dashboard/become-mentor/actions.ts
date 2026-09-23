"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { requestMentorStatus } from "@/services/mentorship/request-mentor-status";
import { requestMentorStatusSchema } from "@/schemas/mentor";

export async function requestMentorStatusAction(input: {
  category: string;
  pitch?: string;
}) {
  const { profile } = await requireUser();
  const parsed = requestMentorStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }

  try {
    await requestMentorStatus(profile.id, parsed.data.category, parsed.data.pitch);
    revalidatePath("/dashboard/become-mentor");
    revalidatePath("/admin/mentors");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
