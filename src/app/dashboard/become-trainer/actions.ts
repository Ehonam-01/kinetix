"use server";

import { revalidatePath } from "next/cache";
import { trainerRequestSchema } from "@/schemas/trainer";
import { requireActiveMember } from "@/services/auth/current-user";
import { requestTrainerStatus } from "@/services/trainers/trainer-requests";

export async function requestTrainerStatusAction(input: unknown) {
  const { profile } = await requireActiveMember();
  const parsed = trainerRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  try {
    await requestTrainerStatus(profile.id, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/dashboard/become-trainer");
  revalidatePath("/admin/trainers");
  return { error: null };
}
