"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { createCourse } from "@/services/lms/create-course";

export async function createCourseAction(input: {
  title: string;
  description?: string;
  price?: number;
  businessVolume?: number;
  category?: string;
}) {
  const { profile } = await requireAdmin();
  const course = await createCourse(profile.id, input);
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}
