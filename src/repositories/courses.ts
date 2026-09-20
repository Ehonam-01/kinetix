import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { courses, lessons, modules } from "@/db/schema/courses";
import { lessonProgress } from "@/db/schema/lesson-progress";
import { profiles } from "@/db/schema/profiles";
import { quizAttempts, quizzes } from "@/db/schema/quizzes";
import { refunds } from "@/db/schema/refunds";
import { sales } from "@/db/schema/sales";
import { hasActiveSubscription } from "./subscriptions";

// A single annual subscription unlocks every course (explicit user decision,
// "remplacement complet": no course keeps an individual price anymore — see
// db/schema/subscriptions.ts). The old per-course sales path is kept only as
// a grandfather clause for whatever was bought before this pivot (courses
// bought individually never lose access retroactively); no code creates new
// sales rows anymore. The level-based path this used to have (course_levels,
// "unlock via member_levels") is retired too — course_levels itself is left
// in the schema unused rather than dropped, same conserve-then-remove-later
// discipline as the rest of this project's migrations. Admins bypass gating
// entirely, for content review.
export async function hasCourseAccess(
  executor: Executor,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const profile = await executor.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  if (profile?.role === "ADMIN") return true;

  if (await hasActiveSubscription(executor, userId)) return true;

  // Legacy: a course bought individually before the subscription pivot.
  const purchased = await executor.query.sales.findFirst({
    where: and(
      eq(sales.buyerUserId, userId),
      eq(sales.courseId, courseId),
      eq(sales.status, "CONFIRMED"),
    ),
  });
  if (purchased) return true;

  // A refunded sale can still grant access — refunds.accessRevoked is a
  // real per-refund policy choice (services/sales/refund-sale.ts), not
  // just a logged flag: an admin can refund the money while letting the
  // buyer keep the formation as a courtesy.
  const refundedSale = await executor.query.sales.findFirst({
    where: and(
      eq(sales.buyerUserId, userId),
      eq(sales.courseId, courseId),
      eq(sales.status, "REFUNDED"),
    ),
  });
  if (refundedSale) {
    const refund = await executor.query.refunds.findFirst({
      where: eq(refunds.saleId, refundedSale.id),
    });
    if (refund && !refund.accessRevoked) return true;
  }

  return false;
}

export function findModuleById(executor: Executor, moduleId: string) {
  return executor.query.modules.findFirst({
    where: eq(modules.id, moduleId),
  });
}

export function findLessonById(executor: Executor, lessonId: string) {
  return executor.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  });
}

// userId is optional: pass it to also annotate each lesson with whether
// this specific member has completed it (used by the course detail page);
// omitted, every lesson comes back with completed: false (used by
// getCourseProgress below, which computes completion counts separately).
export async function getCourseContent(
  executor: Executor,
  courseId: string,
  userId?: string,
) {
  const course = await executor.query.courses.findFirst({
    where: eq(courses.id, courseId),
  });
  if (!course) return null;

  const courseModules = await executor.query.modules.findMany({
    where: and(eq(modules.courseId, courseId), eq(modules.isActive, true)),
    orderBy: asc(modules.position),
  });

  const moduleIds = courseModules.map((m) => m.id);
  const moduleLessons = moduleIds.length
    ? await executor.query.lessons.findMany({
        where: and(
          inArray(lessons.moduleId, moduleIds),
          eq(lessons.isActive, true),
        ),
        orderBy: asc(lessons.position),
      })
    : [];

  const lessonIds = moduleLessons.map((l) => l.id);

  const completedLessonIds =
    userId && lessonIds.length
      ? new Set(
          (
            await executor.query.lessonProgress.findMany({
              where: and(
                eq(lessonProgress.userId, userId),
                inArray(lessonProgress.lessonId, lessonIds),
              ),
            })
          ).map((p) => p.lessonId),
        )
      : new Set<string>();

  // A lesson with a quiz gates the *next* lesson in course order until
  // that quiz is passed — lessons without a quiz never gate anything,
  // same free-to-jump-around behavior as before this existed (see
  // ARCHITECTURE.md, "Génération de cours par IA").
  const lessonQuizzes = lessonIds.length
    ? await executor.query.quizzes.findMany({
        where: inArray(quizzes.lessonId, lessonIds),
      })
    : [];
  const quizIdByLessonId = new Map(
    lessonQuizzes.map((q) => [q.lessonId, q.id]),
  );

  const quizIds = lessonQuizzes.map((q) => q.id);
  const passedQuizIds =
    userId && quizIds.length
      ? new Set(
          (
            await executor.query.quizAttempts.findMany({
              where: and(
                eq(quizAttempts.userId, userId),
                inArray(quizAttempts.quizId, quizIds),
                eq(quizAttempts.passed, true),
              ),
            })
          ).map((a) => a.quizId),
        )
      : new Set<string>();

  // Flatten in true course order (module.position, then lesson.position
  // within it) — the same order the module-grouping below re-derives, so
  // "the previous lesson" here matches what a learner actually sees above
  // the current one on the page.
  const orderedLessons = courseModules.flatMap((m) =>
    moduleLessons.filter((l) => l.moduleId === m.id),
  );
  const lockedLessonIds = new Set<string>();
  let blockedByUnpassedQuiz = false;
  for (const lesson of orderedLessons) {
    if (blockedByUnpassedQuiz) lockedLessonIds.add(lesson.id);
    const quizId = quizIdByLessonId.get(lesson.id);
    blockedByUnpassedQuiz = !!quizId && !passedQuizIds.has(quizId);
  }

  return {
    course,
    modules: courseModules.map((m) => ({
      ...m,
      lessons: moduleLessons
        .filter((l) => l.moduleId === m.id)
        .map((l) => {
          const quizId = quizIdByLessonId.get(l.id) ?? null;
          return {
            ...l,
            completed: completedLessonIds.has(l.id),
            hasQuiz: quizId !== null,
            quizId,
            locked: lockedLessonIds.has(l.id),
          };
        }),
    })),
  };
}

export async function getCourseProgress(
  executor: Executor,
  userId: string,
  courseId: string,
) {
  const content = await getCourseContent(executor, courseId);
  const lessonIds =
    content?.modules.flatMap((m) => m.lessons.map((l) => l.id)) ?? [];
  if (lessonIds.length === 0) {
    return { totalLessons: 0, completedLessons: 0 };
  }

  const completed = await executor.query.lessonProgress.findMany({
    where: and(
      eq(lessonProgress.userId, userId),
      inArray(lessonProgress.lessonId, lessonIds),
    ),
  });
  return { totalLessons: lessonIds.length, completedLessons: completed.length };
}

export type CourseSummary = {
  id: string;
  title: string;
  description: string | null;
  accessible: boolean;
  totalLessons: number;
  completedLessons: number;
};

// The "mes cours" list — deferred in Phase 7 (no page existed yet to call
// it), built now for the Phase 8 dashboard. Access = active subscription (or
// admin, or a legacy per-course purchase from before the subscription
// pivot), same rule as hasCourseAccess above.
export async function listCoursesForUser(
  executor: Executor,
  userId: string,
): Promise<CourseSummary[]> {
  const profile = await executor.query.profiles.findFirst({
    where: eq(profiles.id, userId),
  });
  const isAdmin = profile?.role === "ADMIN";
  const subscribed = await hasActiveSubscription(executor, userId);

  const activeCourses = await executor.query.courses.findMany({
    where: eq(courses.isActive, true),
  });
  if (activeCourses.length === 0) return [];

  if (isAdmin || subscribed) {
    const progressList = await Promise.all(
      activeCourses.map((c) => getCourseProgress(executor, userId, c.id)),
    );
    return activeCourses.map((course, i) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      accessible: true,
      ...progressList[i],
    }));
  }

  const courseIds = activeCourses.map((c) => c.id);
  const [purchases, refundedButKept] = await Promise.all([
    executor.query.sales.findMany({
      where: and(
        eq(sales.buyerUserId, userId),
        eq(sales.status, "CONFIRMED"),
        inArray(sales.courseId, courseIds),
      ),
    }),
    // Same accessRevoked policy as hasCourseAccess above — a refunded
    // sale can still grant access.
    executor.query.sales.findMany({
      where: and(
        eq(sales.buyerUserId, userId),
        eq(sales.status, "REFUNDED"),
        inArray(sales.courseId, courseIds),
      ),
    }),
  ]);
  const purchasedCourseIds = new Set(purchases.map((s) => s.courseId));
  if (refundedButKept.length > 0) {
    const refundRows = await executor.query.refunds.findMany({
      where: inArray(
        refunds.saleId,
        refundedButKept.map((s) => s.id),
      ),
    });
    const keptSaleIds = new Set(
      refundRows.filter((r) => !r.accessRevoked).map((r) => r.saleId),
    );
    for (const s of refundedButKept) {
      if (keptSaleIds.has(s.id)) purchasedCourseIds.add(s.courseId);
    }
  }

  const progressList = await Promise.all(
    activeCourses.map((c) => getCourseProgress(executor, userId, c.id)),
  );

  return activeCourses.map((course, i) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    accessible: purchasedCourseIds.has(course.id),
    ...progressList[i],
  }));
}

export type AdminCourseSummary = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  moduleCount: number;
  lessonCount: number;
};

// Content-management view — not tied to any one member's progress, unlike
// listCoursesForUser above (which computes completedLessons for a
// specific viewer). Includes inactive courses/modules/lessons, since an
// admin needs to see and manage them too.
export async function listAllCoursesForAdmin(
  executor: Executor,
): Promise<AdminCourseSummary[]> {
  const allCourses = await executor.query.courses.findMany({
    orderBy: desc(courses.createdAt),
  });
  if (allCourses.length === 0) return [];

  const courseIds = allCourses.map((c) => c.id);
  const allModules = await executor.query.modules.findMany({
    where: inArray(modules.courseId, courseIds),
  });

  const moduleIds = allModules.map((m) => m.id);
  const allLessons = moduleIds.length
    ? await executor.query.lessons.findMany({
        where: inArray(lessons.moduleId, moduleIds),
      })
    : [];

  const moduleCountByCourse = new Map<string, number>();
  const courseIdByModule = new Map(allModules.map((m) => [m.id, m.courseId]));
  for (const m of allModules) {
    moduleCountByCourse.set(
      m.courseId,
      (moduleCountByCourse.get(m.courseId) ?? 0) + 1,
    );
  }

  const lessonCountByCourse = new Map<string, number>();
  for (const l of allLessons) {
    const courseId = courseIdByModule.get(l.moduleId);
    if (!courseId) continue;
    lessonCountByCourse.set(
      courseId,
      (lessonCountByCourse.get(courseId) ?? 0) + 1,
    );
  }

  return allCourses.map((course) => ({
    id: course.id,
    title: course.title,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    isActive: course.isActive,
    moduleCount: moduleCountByCourse.get(course.id) ?? 0,
    lessonCount: lessonCountByCourse.get(course.id) ?? 0,
  }));
}

export type MarketingCourseSummary = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  moduleCount: number;
  lessonCount: number;
};

// Public homepage listing — no auth, no per-viewer fields (accessible/
// completedLessons come from listCoursesForUser instead). Every PUBLISHED,
// active course is shown — price is display-only here (see create-course.ts):
// access always comes from the subscription, never a per-course charge (see
// db/schema/subscriptions.ts). Most recent first.
export async function listPublishedCoursesForMarketing(
  executor: Executor,
  limit = 6,
): Promise<MarketingCourseSummary[]> {
  const rows = await executor.query.courses.findMany({
    where: and(eq(courses.status, "PUBLISHED"), eq(courses.isActive, true)),
    orderBy: desc(courses.createdAt),
    limit,
  });
  if (rows.length === 0) return [];

  const courseIds = rows.map((c) => c.id);
  const activeModules = await executor.query.modules.findMany({
    where: and(
      inArray(modules.courseId, courseIds),
      eq(modules.isActive, true),
    ),
  });

  const moduleIds = activeModules.map((m) => m.id);
  const activeLessons = moduleIds.length
    ? await executor.query.lessons.findMany({
        where: and(
          inArray(lessons.moduleId, moduleIds),
          eq(lessons.isActive, true),
        ),
      })
    : [];

  const moduleCountByCourse = new Map<string, number>();
  for (const m of activeModules) {
    moduleCountByCourse.set(
      m.courseId,
      (moduleCountByCourse.get(m.courseId) ?? 0) + 1,
    );
  }
  const courseIdByModule = new Map(
    activeModules.map((m) => [m.id, m.courseId]),
  );
  const lessonCountByCourse = new Map<string, number>();
  for (const l of activeLessons) {
    const courseId = courseIdByModule.get(l.moduleId);
    if (!courseId) continue;
    lessonCountByCourse.set(
      courseId,
      (lessonCountByCourse.get(courseId) ?? 0) + 1,
    );
  }

  return rows.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    category: course.category,
    price: course.price,
    thumbnailUrl: course.thumbnailUrl,
    durationMinutes: course.durationMinutes,
    moduleCount: moduleCountByCourse.get(course.id) ?? 0,
    lessonCount: lessonCountByCourse.get(course.id) ?? 0,
  }));
}
