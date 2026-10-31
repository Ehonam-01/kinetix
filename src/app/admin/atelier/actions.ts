"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  addWorkshopRegistration,
  updateWorkshopSettings,
} from "@/services/workshops/admin";

type SettingsInput = Parameters<typeof updateWorkshopSettings>[1];
type RegistrationInput = Parameters<typeof addWorkshopRegistration>[1];

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}

export async function updateWorkshopSettingsAction(input: SettingsInput) {
  const { profile } = await requireAdmin();
  try {
    await updateWorkshopSettings(profile.id, input);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/admin/atelier");
  revalidatePath("/atelier-video-ia");
  return { error: null };
}

export async function addWorkshopRegistrationAction(input: RegistrationInput) {
  const { profile } = await requireAdmin();
  try {
    await addWorkshopRegistration(profile.id, input);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/admin/atelier");
  return { error: null };
}
