"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { uploadCourseThumbnail } from "@/services/lms/upload-course-thumbnail";
import { revalidatePublicCourses } from "@/lib/revalidate-public-courses";

export async function uploadCourseThumbnailAction(
  courseId: string,
  file: File,
) {
  const { profile } = await requireAdmin();
  try {
    const thumbnailUrl = await uploadCourseThumbnail(
      profile.id,
      courseId,
      file,
    );
    revalidatePath(`/admin/courses/${courseId}`);
    revalidatePublicCourses();
    revalidatePath("/admin/courses");
    return { thumbnailUrl, error: null };
  } catch (err) {
    return {
      thumbnailUrl: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
