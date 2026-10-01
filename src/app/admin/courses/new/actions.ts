"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { createCourse } from "@/services/lms/create-course";
import { revalidatePublicCourses } from "@/lib/revalidate-public-courses";

export async function createCourseAction(input: {
  title: string;
  description?: string;
  price?: number;
  category?: string;
}) {
  const { profile } = await requireAdmin();
  let course;
  try {
    course = await createCourse(profile.id, input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/admin/courses");
  revalidatePublicCourses();
  redirect(`/admin/courses/${course.id}`);
}
