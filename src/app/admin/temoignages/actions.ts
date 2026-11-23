"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  addSiteTestimonial,
  deleteSiteTestimonial,
  moveSiteTestimonial,
  setSiteTestimonialPublished,
} from "@/services/site/testimonials";

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Une erreur est survenue.";
}

function revalidate() {
  revalidatePath("/admin/temoignages");
  revalidatePath("/");
}

export async function addSiteTestimonialAction(formData: FormData) {
  const { profile } = await requireAdmin();
  const photo = formData.get("photo");
  try {
    await addSiteTestimonial(
      profile.id,
      {
        firstName: String(formData.get("firstName") ?? ""),
        city: String(formData.get("city") ?? ""),
        courseTitle: String(formData.get("courseTitle") ?? ""),
        quote: String(formData.get("quote") ?? ""),
        videoUrl: String(formData.get("videoUrl") ?? ""),
      },
      photo instanceof File && photo.size > 0 ? photo : null,
    );
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidate();
  return { error: null };
}

export async function setSiteTestimonialPublishedAction(
  id: string,
  isPublished: boolean,
) {
  const { profile } = await requireAdmin();
  try {
    await setSiteTestimonialPublished(profile.id, id, isPublished);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidate();
  return { error: null };
}

export async function moveSiteTestimonialAction(
  id: string,
  direction: "up" | "down",
) {
  const { profile } = await requireAdmin();
  try {
    await moveSiteTestimonial(profile.id, id, direction);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidate();
  return { error: null };
}

export async function deleteSiteTestimonialAction(id: string) {
  const { profile } = await requireAdmin();
  try {
    await deleteSiteTestimonial(profile.id, id);
  } catch (err) {
    return { error: errorMessage(err) };
  }
  revalidate();
  return { error: null };
}
