"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  addWorkshopRegistration,
  markWorkshopBalancePaid,
  updateWorkshopPage,
  updateWorkshopSession,
} from "@/services/workshops/admin";
import {
  addImageTestimonial,
  addTextTestimonial,
  deleteTestimonial,
  moveTestimonial,
  setTestimonialPublished,
} from "@/services/workshops/testimonials";

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

// ---- Participants' testimonials (services/workshops/testimonials.ts).

function revalidateTestimonials() {
  revalidatePath("/admin/atelier");
  revalidatePath("/atelier-video-ia");
}

export async function addTextTestimonialAction(
  input: Parameters<typeof addTextTestimonial>[1],
) {
  const { profile } = await requireAdmin();
  try {
    await addTextTestimonial(profile.id, input);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateTestimonials();
  return { error: null };
}

export async function addImageTestimonialAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisis une capture d'écran." };
  }
  try {
    await addImageTestimonial(profile.id, file, {
      authorName: String(formData.get("authorName") ?? ""),
      authorDetail: String(formData.get("authorDetail") ?? ""),
    });
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateTestimonials();
  return { error: null };
}

export async function setTestimonialPublishedAction(
  id: string,
  isPublished: boolean,
) {
  const { profile } = await requireAdmin();
  try {
    await setTestimonialPublished(profile.id, id, isPublished);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateTestimonials();
  return { error: null };
}

export async function moveTestimonialAction(
  id: string,
  direction: "up" | "down",
) {
  const { profile } = await requireAdmin();
  try {
    await moveTestimonial(profile.id, id, direction);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateTestimonials();
  return { error: null };
}

export async function deleteTestimonialAction(id: string) {
  const { profile } = await requireAdmin();
  try {
    await deleteTestimonial(profile.id, id);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidateTestimonials();
  return { error: null };
}
