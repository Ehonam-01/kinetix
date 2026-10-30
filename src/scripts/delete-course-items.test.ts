// Deleting a lesson or a module from the admin, against a disposable pglite
// database with every real migration applied: admins only, everything
// attached to the lesson goes with it, other lessons stay, the audit log
// keeps a trace, and the positions left behind don't break reordering.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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

async function makeProfile(role: "USER" | "ADMIN") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `p_${id.slice(0, 8)}`,
    fullName: "Profil de test",
    status: "ACTIVE",
    role,
  });
  return id;
}

// Two modules; the first holds three lessons, the second one lesson. The
// second lesson of module 1 carries a quiz, an attempt, a completion and a
// discussion post from a member.
async function makeCourse(memberId: string) {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title: "Formation", status: "PUBLISHED" })
    .returning();
  const [m1, m2] = await localDb
    .insert(schema.modules)
    .values([
      { courseId: course.id, title: "Module 1", position: 1 },
      { courseId: course.id, title: "Module 2", position: 2 },
    ])
    .returning();
  const [a, b, c, d] = await localDb
    .insert(schema.lessons)
    .values([
      { moduleId: m1.id, title: "A", lessonType: "VIDEO", position: 1 },
      { moduleId: m1.id, title: "B", lessonType: "VIDEO", position: 2 },
      { moduleId: m1.id, title: "C", lessonType: "VIDEO", position: 3 },
      { moduleId: m2.id, title: "D", lessonType: "VIDEO", position: 1 },
    ])
    .returning();
  const [quiz] = await localDb
    .insert(schema.quizzes)
    .values({ lessonId: b.id })
    .returning();
  await localDb.insert(schema.quizAttempts).values({
    userId: memberId,
    quizId: quiz.id,
    score: 100,
    passed: true,
    answers: {},
  });
  await localDb
    .insert(schema.lessonProgress)
    .values({ userId: memberId, lessonId: b.id });
  await localDb.insert(schema.lessonPosts).values({
    lessonId: b.id,
    authorId: memberId,
    body: "Une question",
  });
  return { m1, m2, a, b, c, d, quiz };
}

describe("deleting course items (pglite, no shared DB touched)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("refuses a non-admin", async () => {
    const { deleteLesson, deleteModule } =
      await import("@/services/lms/delete-course-item");
    const member = await makeProfile("USER");
    const c = await makeCourse(member);

    await expect(deleteLesson(member, c.b.id)).rejects.toThrow(
      "Seul un administrateur",
    );
    await expect(deleteModule(member, c.m1.id)).rejects.toThrow(
      "Seul un administrateur",
    );
    expect(
      await localDb.query.lessons.findFirst({
        where: eq(schema.lessons.id, c.b.id),
      }),
    ).toBeTruthy();
  });

  it("deletes a lesson with what hangs off it, and logs it", async () => {
    const { deleteLesson } = await import("@/services/lms/delete-course-item");
    const { moveLesson } = await import("@/services/lms/reorder-course-items");
    const admin = await makeProfile("ADMIN");
    const member = await makeProfile("USER");
    const c = await makeCourse(member);

    await deleteLesson(admin, c.b.id);

    const left = await localDb.query.lessons.findMany({
      where: eq(schema.lessons.moduleId, c.m1.id),
    });
    expect(left.map((l: { title: string }) => l.title).sort()).toEqual([
      "A",
      "C",
    ]);
    expect(
      await localDb.query.quizzes.findFirst({
        where: eq(schema.quizzes.id, c.quiz.id),
      }),
    ).toBeUndefined();
    expect(
      await localDb.query.quizAttempts.findMany({
        where: eq(schema.quizAttempts.userId, member),
      }),
    ).toEqual([]);
    expect(
      await localDb.query.lessonProgress.findMany({
        where: eq(schema.lessonProgress.userId, member),
      }),
    ).toEqual([]);
    expect(
      await localDb.query.lessonPosts.findMany({
        where: eq(schema.lessonPosts.authorId, member),
      }),
    ).toEqual([]);

    const [log] = await localDb.query.auditLogs.findMany({
      where: eq(schema.auditLogs.targetId, c.b.id),
    });
    expect(log.action).toBe("LESSON_DELETED");
    expect(log.metadata).toMatchObject({
      title: "B",
      completions: 1,
      posts: 1,
    });

    // The gap left at position 2 doesn't stop A and C from swapping.
    await moveLesson(admin, c.c.id, "up");
  });

  it("deletes a module with its lessons, and only those", async () => {
    const { deleteModule } = await import("@/services/lms/delete-course-item");
    const admin = await makeProfile("ADMIN");
    const member = await makeProfile("USER");
    const c = await makeCourse(member);

    await deleteModule(admin, c.m1.id);

    expect(
      await localDb.query.modules.findFirst({
        where: eq(schema.modules.id, c.m1.id),
      }),
    ).toBeUndefined();
    expect(
      await localDb.query.lessons.findMany({
        where: eq(schema.lessons.moduleId, c.m1.id),
      }),
    ).toEqual([]);
    expect(
      await localDb.query.lessons.findFirst({
        where: eq(schema.lessons.id, c.d.id),
      }),
    ).toBeTruthy();

    const [log] = await localDb.query.auditLogs.findMany({
      where: eq(schema.auditLogs.targetId, c.m1.id),
    });
    expect(log.action).toBe("MODULE_DELETED");
    expect(log.metadata).toMatchObject({
      lessons: expect.arrayContaining(["A", "B", "C"]),
      completions: 1,
    });
  });
});
