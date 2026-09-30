"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import {
  adminDismissLessonPostReports,
  adminHideLessonPost,
  adminRestoreLessonPost,
} from "@/services/lms/lesson-discussion";

export async function moderateLessonPostAction(
  postId: string,
  decision: "hide" | "restore" | "dismiss",
) {
  const { profile } = await requireAdmin();
  try {
    if (decision === "hide") await adminHideLessonPost(profile.id, postId);
    else if (decision === "restore")
      await adminRestoreLessonPost(profile.id, postId);
    else await adminDismissLessonPostReports(profile.id, postId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/discussions");
  return { error: null };
}
