"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  approveTrainerRequest,
  rejectTrainerRequest,
} from "@/services/trainers/trainer-requests";

const failure = (err: unknown) => ({
  error: err instanceof Error ? err.message : "Une erreur est survenue.",
});

export async function approveTrainerRequestAction(trainerProfileId: string) {
  const { profile } = await requireAdmin();
  try {
    await approveTrainerRequest(profile.id, trainerProfileId);
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/trainers");
  return { error: null };
}

export async function rejectTrainerRequestAction(
  trainerProfileId: string,
  reason: string,
) {
  const { profile } = await requireAdmin();
  try {
    await rejectTrainerRequest(profile.id, trainerProfileId, reason);
  } catch (err) {
    return failure(err);
  }
  revalidatePath("/admin/trainers");
  return { error: null };
}
