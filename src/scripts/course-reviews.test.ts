// Learners rating and commenting the courses, against a disposable pglite
// database with every real migration applied: only a member who has the
// course and completed a lesson can review it, once (edited in place); the
// average counts visible reviews only; an admin hides and restores them.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createSimulationDb,
  seedBaselineParameters,
} from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

const DAY_MS = 24 * 60 * 60 * 1000;

async function makeProfile(label: string, role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `${label} Test`,
    status: "ACTIVE",
    role,
  });
  return id;
}

async function subscribe(userId: string) {
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: userId,
      purpose: "SUBSCRIPTION",
      method: "ADMIN_CREDIT",
      amount: 300,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 30 * DAY_MS),
    pricePaid: 300,
    businessVolume: 15,
  });
}

async function makeCourse() {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title: "Formation notée", status: "PUBLISHED" })
    .returning();
  const [mod] = await localDb
    .insert(schema.modules)
    .values({ courseId: course.id, title: "Module 1", position: 1 })
    .returning();
  const [lesson] = await localDb
    .insert(schema.lessons)
    .values({
      moduleId: mod.id,
      title: "Leçon 1",
      lessonType: "TEXT",
      content: "Un paragraphe.",
      position: 1,
    })
    .returning();
  return { courseId: course.id, lessonId: lesson.id };
}

const complete = (userId: string, lessonId: string) =>
  localDb.insert(schema.lessonProgress).values({ userId, lessonId });

describe("course reviews (pglite)", () => {
  let course: { courseId: string; lessonId: string };

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    course = await makeCourse();
  }, 120_000);

  it("needs access to the course and one completed lesson", async () => {
    const svc = await import("@/services/lms/course-reviews");
    const visitor = await makeProfile("visiteur");
    await expect(
      svc.saveCourseReview(visitor, course.courseId, { rating: 5 }),
    ).rejects.toThrow("pas accès");

    const member = await makeProfile("afi");
    await subscribe(member);
    expect(await svc.reviewEligibility(localDb, member, course.courseId)).toBe(
      "NOT_STARTED",
    );
    await expect(
      svc.saveCourseReview(member, course.courseId, { rating: 5 }),
    ).rejects.toThrow("au moins une leçon");

    await complete(member, course.lessonId);
    expect(await svc.reviewEligibility(localDb, member, course.courseId)).toBe(
      "CAN_REVIEW",
    );
  });

  it("keeps one review per member, edited in place, and averages them", async () => {
    const svc = await import("@/services/lms/course-reviews");
    const a = await makeProfile("kofi");
    const b = await makeProfile("ama");
    for (const id of [a, b]) {
      await subscribe(id);
      await complete(id, course.lessonId);
    }

    await svc.saveCourseReview(a, course.courseId, {
      rating: 2,
      comment: "Trop rapide",
    });
    await svc.saveCourseReview(a, course.courseId, {
      rating: 4,
      comment: "Finalement très utile",
    });
    await svc.saveCourseReview(b, course.courseId, { rating: 5, comment: "" });

    const summary = (
      await svc.getRatingSummaries(localDb, [course.courseId])
    ).get(course.courseId);
    expect(summary).toEqual({ average: 4.5, count: 2 });

    const reviews = await svc.listCourseReviews(localDb, course.courseId);
    expect(reviews).toHaveLength(2);
    expect(reviews.find((r) => r.rating === 4)).toMatchObject({
      author: "kofi",
      comment: "Finalement très utile",
    });
    expect(reviews.find((r) => r.rating === 5)?.comment).toBeNull();
  });

  it("refuses a rating outside 1 to 5", async () => {
    const svc = await import("@/services/lms/course-reviews");
    expect(svc.courseReviewSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(svc.courseReviewSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(svc.courseReviewSchema.safeParse({ rating: 3.5 }).success).toBe(
      false,
    );
  });

  it("lets an admin hide a review from every count and list", async () => {
    const svc = await import("@/services/lms/course-reviews");
    const admin = await makeProfile("admin", "ADMIN");
    const member = await makeProfile("yao");
    await subscribe(member);
    await complete(member, course.lessonId);
    const review = await svc.saveCourseReview(member, course.courseId, {
      rating: 1,
      comment: "Message abusif",
    });

    await expect(
      svc.setCourseReviewHidden(member, review.id, true),
    ).rejects.toThrow("Seul un administrateur");

    await svc.setCourseReviewHidden(admin, review.id, true);
    expect(
      (await svc.listCourseReviews(localDb, course.courseId)).map((r) => r.id),
    ).not.toContain(review.id);
    expect(
      (await svc.getRatingSummaries(localDb, [course.courseId])).get(
        course.courseId,
      )?.count,
    ).toBe(2);

    await svc.setCourseReviewHidden(admin, review.id, false);
    expect(
      (await svc.getRatingSummaries(localDb, [course.courseId])).get(
        course.courseId,
      )?.count,
    ).toBe(3);
  });
});
