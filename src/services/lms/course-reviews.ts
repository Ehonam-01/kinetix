import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { courseReviews } from "@/db/schema/course-reviews";
import { courses, lessons, modules } from "@/db/schema/courses";
import { lessonProgress } from "@/db/schema/lesson-progress";
import { profiles } from "@/db/schema/profiles";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { isUuid } from "@/lib/utils";
import { hasCourseAccess } from "@/repositories/courses";
import { logAdminAction } from "@/services/admin/audit-log";

// Learners rating and commenting the courses (course_reviews): one review
// per member and course, edited in place; only from a member who has the
// course and completed at least one of its lessons — an opinion from
// someone who actually followed it. Hidden reviews (admin) count nowhere.

export const courseReviewSchema = z.object({
  rating: z
    .number()
    .int()
    .min(1, "Choisis une note de 1 à 5 étoiles.")
    .max(5, "Choisis une note de 1 à 5 étoiles."),
  comment: z
    .string()
    .trim()
    .max(1000, "1 000 caractères maximum")
    .optional()
    .or(z.literal("")),
});
export type CourseReviewInput = z.infer<typeof courseReviewSchema>;

export type ReviewEligibility = "CAN_REVIEW" | "NO_ACCESS" | "NOT_STARTED";

export async function reviewEligibility(
  executor: Executor,
  userId: string,
  courseId: string,
): Promise<ReviewEligibility> {
  if (!(await hasCourseAccess(executor, userId, courseId))) return "NO_ACCESS";
  const [done] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
    .innerJoin(modules, eq(modules.id, lessons.moduleId))
    .where(
      and(eq(lessonProgress.userId, userId), eq(modules.courseId, courseId)),
    );
  return (done?.n ?? 0) > 0 ? "CAN_REVIEW" : "NOT_STARTED";
}

export async function getOwnCourseReview(userId: string, courseId: string) {
  return (
    (await db.query.courseReviews.findFirst({
      where: and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId),
      ),
    })) ?? null
  );
}

export async function saveCourseReview(
  userId: string,
  courseId: string,
  input: CourseReviewInput,
) {
  if (!isUuid(courseId)) throw new Error("Formation introuvable.");
  const data = courseReviewSchema.parse(input);
  const eligibility = await reviewEligibility(db, userId, courseId);
  if (eligibility === "NO_ACCESS") {
    throw new Error("Tu n'as pas accès à cette formation.");
  }
  if (eligibility === "NOT_STARTED") {
    throw new Error(
      "Termine au moins une leçon de la formation pour donner ton avis.",
    );
  }
  if (await isRateLimited("lessonPost", `user:${userId}`)) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  const comment = data.comment || null;
  const [saved] = await db
    .insert(courseReviews)
    .values({ courseId, userId, rating: data.rating, comment })
    .onConflictDoUpdate({
      target: [courseReviews.courseId, courseReviews.userId],
      set: { rating: data.rating, comment, updatedAt: new Date() },
    })
    .returning();
  return saved;
}

export async function deleteOwnCourseReview(userId: string, courseId: string) {
  if (!isUuid(courseId)) throw new Error("Formation introuvable.");
  await db
    .delete(courseReviews)
    .where(
      and(
        eq(courseReviews.userId, userId),
        eq(courseReviews.courseId, courseId),
      ),
    );
}

// ------------------------------------------------------------ display

export type RatingSummary = { average: number; count: number };

// Average and count of the visible reviews, per course.
export async function getRatingSummaries(
  executor: Executor,
  courseIds: string[],
): Promise<Map<string, RatingSummary>> {
  if (courseIds.length === 0) return new Map();
  const rows = await executor
    .select({
      courseId: courseReviews.courseId,
      average: sql<number>`avg(${courseReviews.rating})::float`,
      count: sql<number>`count(*)::int`,
    })
    .from(courseReviews)
    .where(
      and(
        inArray(courseReviews.courseId, courseIds),
        isNull(courseReviews.hiddenAt),
      ),
    )
    .groupBy(courseReviews.courseId);
  return new Map(
    rows.map((r) => [r.courseId, { average: r.average, count: r.count }]),
  );
}

// The visible reviews of a course, most recent first, with the author's
// first name only (they're shown on the public course page too).
export async function listCourseReviews(
  executor: Executor,
  courseId: string,
  limit = 20,
) {
  const rows = await executor
    .select({
      id: courseReviews.id,
      rating: courseReviews.rating,
      comment: courseReviews.comment,
      updatedAt: courseReviews.updatedAt,
      fullName: profiles.fullName,
      authorStatus: profiles.status,
    })
    .from(courseReviews)
    .innerJoin(profiles, eq(profiles.id, courseReviews.userId))
    .where(
      and(eq(courseReviews.courseId, courseId), isNull(courseReviews.hiddenAt)),
    )
    .orderBy(desc(courseReviews.updatedAt))
    .limit(limit);
  return rows.map(({ fullName, authorStatus, ...r }) => ({
    ...r,
    author:
      authorStatus === "DELETED"
        ? "Ancien membre"
        : (fullName.trim().split(/\s+/)[0] ?? "Membre"),
  }));
}

// ----------------------------------------------------------------- admin

export async function listReviewsForAdmin(limit = 100) {
  return db
    .select({
      review: courseReviews,
      courseTitle: courses.title,
      fullName: profiles.fullName,
      username: profiles.username,
    })
    .from(courseReviews)
    .innerJoin(courses, eq(courses.id, courseReviews.courseId))
    .innerJoin(profiles, eq(profiles.id, courseReviews.userId))
    .orderBy(desc(courseReviews.updatedAt))
    .limit(limit);
}

export async function setCourseReviewHidden(
  adminUserId: string,
  reviewId: string,
  hidden: boolean,
) {
  if (!isUuid(reviewId)) throw new Error("Avis introuvable.");
  await db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modérer un avis.");
    }
    const [review] = await tx
      .update(courseReviews)
      .set(
        hidden
          ? { hiddenAt: new Date(), hiddenBy: adminUserId }
          : { hiddenAt: null, hiddenBy: null },
      )
      .where(eq(courseReviews.id, reviewId))
      .returning();
    if (!review) throw new Error("Avis introuvable.");
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: hidden ? "COURSE_REVIEW_HIDDEN" : "COURSE_REVIEW_RESTORED",
      targetType: "course_review",
      targetId: review.id,
      metadata: { courseId: review.courseId, userId: review.userId },
    });
  });
}
