"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { createModule } from "@/services/lms/create-module";
import { createLesson } from "@/services/lms/create-lesson";
import { updateModule } from "@/services/lms/update-module";
import { updateCourseStatus } from "@/services/lms/update-course-status";
import type {
  courseStatusEnum,
  lessonTypeEnum,
  videoProviderEnum,
} from "@/db/schema/courses";

type VideoProvider = (typeof videoProviderEnum.enumValues)[number];
type LessonType = (typeof lessonTypeEnum.enumValues)[number];
type CourseStatus = (typeof courseStatusEnum.enumValues)[number];

export async function createModuleAction(courseId: string, title: string) {
  const { profile } = await requireAdmin();
  await createModule(profile.id, { courseId, title });
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createLessonAction(
  courseId: string,
  input: {
    moduleId: string;
    title: string;
    lessonType: LessonType;
    description?: string;
    videoProvider?: VideoProvider;
    videoUrl?: string;
    content?: string;
  },
) {
  const { profile } = await requireAdmin();
  await createLesson(profile.id, input);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function updateModuleAction(
  courseId: string,
  moduleId: string,
  input: { title: string; isActive: boolean },
) {
  const { profile } = await requireAdmin();
  try {
    await updateModule(profile.id, moduleId, input);
    revalidatePath(`/admin/courses/${courseId}`);
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function updateCourseStatusAction(
  courseId: string,
  status: CourseStatus,
) {
  const { profile } = await requireAdmin();
  await updateCourseStatus(profile.id, courseId, status);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/admin/courses");
  revalidatePath("/");
}
