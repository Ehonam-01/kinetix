"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  addWorkshopRegistration,
  markWorkshopBalancePaid,
  updateWorkshopPage,
  updateWorkshopSession,
} from "@/services/workshops/admin";

type PageInput = Parameters<typeof updateWorkshopPage>[1];
type SessionInput = Parameters<typeof updateWorkshopSession>[2];
type RegistrationInput = Parameters<typeof addWorkshopRegistration>[1];

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}

function revalidateWorkshop() {
  revalidatePath("/admin/atelier");
  revalidatePath("/atelier-video-ia");
  revalidatePath("/atelier-video-ia/inscription");
}

export async function updateWorkshopPageAction(input: PageInput) {
  const { profile } = await requireAdmin();
  try {
    await updateWorkshopPage(profile.id, input);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateWorkshop();
  return { error: null };
}

export async function updateWorkshopSessionAction(
  sessionId: string,
  input: SessionInput,
) {
  const { profile } = await requireAdmin();
  try {
    await updateWorkshopSession(profile.id, sessionId, input);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateWorkshop();
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

export async function markWorkshopBalancePaidAction(registrationId: string) {
  const { profile } = await requireAdmin();
  try {
    await markWorkshopBalancePaid(profile.id, registrationId);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidatePath("/admin/atelier");
  return { error: null };
}
