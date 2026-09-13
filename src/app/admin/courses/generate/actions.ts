"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { generateCourseWithAI } from "@/services/lms/generate-course-with-ai";

export async function generateCourseAction(input: {
  topic: string;
  moduleCount: number;
  contentType: "VIDEO" | "TEXT" | "MIXED";
  level?: string;
}) {
  const { profile } = await requireAdmin();

  let course;
  try {
    course = await generateCourseWithAI(profile.id, input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}
