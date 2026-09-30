// The learner-side gates of a course, end to end against a disposable
// pglite database (every real migration applied, nothing shared touched):
// a draft course stays invisible to members, a locked lesson can't be
// completed out of order, and a lesson with a quiz is only completed by
// passing the quiz — never by calling the "mark complete" action directly.
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

async function makeProfile(label: string, role: "USER" | "ADMIN") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `Profil ${label}`,
    status: "ACTIVE",
    role,
  });
  return id;
}

async function makeSubscribedMember(label: string) {
  const id = await makeProfile(label, "USER");
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: id,
      purpose: "SUBSCRIPTION",
      method: "ADMIN_CREDIT",
      amount: 300,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.subscriptions).values({
    userId: id,
    paymentId: payment.id,
    expiresAt: new Date(Date.now() + 30 * DAY_MS),
    pricePaid: 300,
    businessVolume: 15,
  });
  return id;
}

// A course of three text lessons: 1 (no quiz) → 2 (quiz) → 3 (locked until
// the quiz of lesson 2 is passed).
async function makeCourse(status: "DRAFT" | "PUBLISHED") {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title: `Formation ${status}`, status })
    .returning();
  const [mod] = await localDb
    .insert(schema.modules)
    .values({ courseId: course.id, title: "Module 1", position: 1 })
    .returning();
  const lessonRows = await localDb
    .insert(schema.lessons)
    .values(
      [1, 2, 3].map((position) => ({
        moduleId: mod.id,
        title: `Leçon ${position}`,
        lessonType: "TEXT",
        content: "## Titre\n\nUn paragraphe.",
        position,
      })),
    )
    .returning();
  const [l1, l2, l3] = lessonRows.sort(
    (a: { position: number }, b: { position: number }) =>
      a.position - b.position,
  );
  const [quiz] = await localDb
    .insert(schema.quizzes)
    .values({ lessonId: l2.id, passingScore: 100 })
    .returning();
  const good = randomUUID();
  const bad = randomUUID();
  const [question] = await localDb
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      question: "Deux plus deux ?",
      options: [
        { id: good, text: "4", isCorrect: true },
        { id: bad, text: "5", isCorrect: false },
      ],
      position: 1,
    })
    .returning();
  return {
    courseId: course.id,
    lessonIds: [l1.id, l2.id, l3.id],
    questionId: question.id,
    good,
    bad,
  };
}

describe("course learner gates (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("hides a draft course from members but not from admins", async () => {
    const { hasCourseAccess, listCoursesForUser } = await import(
      "@/repositories/courses"
    );
    const { markLessonComplete } = await import(
      "@/services/lms/mark-lesson-complete"
    );
    const member = await makeSubscribedMember("draft");
    const admin = await makeProfile("admin", "ADMIN");
    const draft = await makeCourse("DRAFT");
    const published = await makeCourse("PUBLISHED");

    expect(await hasCourseAccess(localDb, member, draft.courseId)).toBe(false);
    expect(await hasCourseAccess(localDb, member, published.courseId)).toBe(
      true,
    );
    expect(await hasCourseAccess(localDb, admin, draft.courseId)).toBe(true);

    const listed = (await listCoursesForUser(localDb, member)).map(
      (c: { id: string }) => c.id,
    );
    expect(listed).toContain(published.courseId);
    expect(listed).not.toContain(draft.courseId);

    await expect(
      markLessonComplete(member, draft.lessonIds[0]),
    ).rejects.toThrow("Vous n'avez pas accès à ce cours.");
  });

  it("only completes a quiz lesson through the quiz, and keeps order", async () => {
    const { markLessonComplete } = await import(
      "@/services/lms/mark-lesson-complete"
    );
    const { submitQuizAttempt } = await import(
      "@/services/lms/submit-quiz-attempt"
    );
    const { getCourseContent } = await import("@/repositories/courses");
    const member = await makeSubscribedMember("quiz");
    const c = await makeCourse("PUBLISHED");
    const [l1, l2, l3] = c.lessonIds;

    // Lesson 1 has no quiz: the button works.
    await markLessonComplete(member, l1);

    // Lesson 2 has a quiz: the button is refused, only the quiz counts.
    await expect(markLessonComplete(member, l2)).rejects.toThrow(
      "Réussis le quiz pour valider cette leçon.",
    );

    // Lesson 3 is locked until lesson 2's quiz is passed.
    await expect(markLessonComplete(member, l3)).rejects.toThrow(
      "Cette leçon est verrouillée.",
    );

    const failed = await submitQuizAttempt(member, l2, {
      [c.questionId]: c.bad,
    });
    expect(failed.passed).toBe(false);
    await expect(markLessonComplete(member, l3)).rejects.toThrow(
      "Cette leçon est verrouillée.",
    );

    const passed = await submitQuizAttempt(member, l2, {
      [c.questionId]: c.good,
    });
    expect(passed.passed).toBe(true);
    await markLessonComplete(member, l3);

    const content = await getCourseContent(localDb, c.courseId, member);
    const done = content!.modules
      .flatMap((m: { lessons: { completed: boolean }[] }) => m.lessons)
      .map((l: { completed: boolean }) => l.completed);
    expect(done).toEqual([true, true, true]);
  });
});
