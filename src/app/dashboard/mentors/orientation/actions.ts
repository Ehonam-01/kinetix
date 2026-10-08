"use server";

import { revalidatePath } from "next/cache";
import { orientationRequestSchema } from "@/schemas/orientation";
import { requireActiveMember } from "@/services/auth/current-user";
import { submitOrientationRequest } from "@/services/orientation/orientation-requests";

export async function submitOrientationRequestAction(input: unknown) {
  const { profile } = await requireActiveMember();
  const parsed = orientationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Entrée invalide." };
  }
  try {
    await submitOrientationRequest(profile.id, parsed.data);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/dashboard/mentors/orientation");
  revalidatePath("/admin/orientation");
  return { error: null };
}
