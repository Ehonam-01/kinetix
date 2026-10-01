"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { createModule } from "@/services/lms/create-module";
import { createLesson } from "@/services/lms/create-lesson";
import { updateModule } from "@/services/lms/update-module";
import { updateCourseStatus } from "@/services/lms/update-course-status";
import { updateCoursePricing } from "@/services/lms/update-course-pricing";
import {
  moveLesson,
  moveModule,
  type MoveDirection,
} from "@/services/lms/reorder-course-items";
import type {
  courseStatusEnum,
  lessonTypeEnum,
  videoProviderEnum,
} from "@/db/schema/courses";
import { revalidatePublicCourses } from "@/lib/revalidate-public-courses";

type VideoProvider = (typeof videoProviderEnum.enumValues)[number];
type LessonType = (typeof lessonTypeEnum.enumValues)[number];
type CourseStatus = (typeof courseStatusEnum.enumValues)[number];

export async function createModuleAction(courseId: string, title: string) {
  const { profile } = await requireAdmin();
  try {
    await createModule(profile.id, { courseId, title });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePublicCourses();
  return { error: null };
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
  try {
    await createLesson(profile.id, input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePublicCourses();
  return { error: null };
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
    revalidatePublicCourses();
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
  revalidatePublicCourses();
  revalidatePath("/admin/courses");
}

export async function updateCoursePricingAction(
  courseId: string,
  input: { price: number | null; category: string | null },
) {
  const { profile } = await requireAdmin();
  try {
    await updateCoursePricing(profile.id, courseId, input);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePublicCourses();
  return { error: null };
}

export async function moveCourseItemAction(
  courseId: string,
  kind: "module" | "lesson",
  id: string,
  direction: MoveDirection,
) {
  const { profile } = await requireAdmin();
  try {
    if (kind === "module") await moveModule(profile.id, id, direction);
    else await moveLesson(profile.id, id, direction);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  // "layout" also refreshes the learner pages under this course.
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePublicCourses();
  revalidatePath(`/dashboard/courses/${courseId}`, "layout");
  return { error: null };
}
