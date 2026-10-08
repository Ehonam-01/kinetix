// The admin course tools, end to end against a disposable pglite database
// (every real migration applied, nothing shared touched): reordering
// modules and lessons, hidden items staying listed for the admin, and the
// per-course stats (admins left out of every number).
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
    fullName: "Profil test",
    status: "ACTIVE",
    role,
  });
  return id;
}

// Two modules: A (lessons A1, A2, A3) and B (lesson B1).
async function makeCourse() {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title: "Formation test" })
    .returning();
  const [modA, modB] = await localDb
    .insert(schema.modules)
    .values([
      { courseId: course.id, title: "A", position: 1 },
      { courseId: course.id, title: "B", position: 2 },
    ])
    .returning();
  const rows = await localDb
    .insert(schema.lessons)
    .values([
      { moduleId: modA.id, title: "A1", lessonType: "TEXT", position: 1 },
      { moduleId: modA.id, title: "A2", lessonType: "TEXT", position: 2 },
      { moduleId: modA.id, title: "A3", lessonType: "TEXT", position: 3 },
      { moduleId: modB.id, title: "B1", lessonType: "TEXT", position: 1 },
    ])
    .returning();
  const byTitle = Object.fromEntries(
    rows.map((r: { title: string; id: string }) => [r.title, r.id]),
  ) as Record<"A1" | "A2" | "A3" | "B1", string>;
  return { courseId: course.id, modA: modA.id, modB: modB.id, ...byTitle };
}

async function titles(courseId: string, includeInactive = false) {
  const { getCourseContent } = await import("@/repositories/courses");
  const content = await getCourseContent(localDb, courseId, undefined, {
    includeInactive,
  });
  return content!.modules.map(
    (m: { title: string; lessons: { title: string }[] }) =>
      `${m.title}:${m.lessons.map((l) => l.title).join(",")}`,
  );
}

describe("admin course tools (pglite, no shared DB touched)", () => {
  let admin: string;

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
    admin = await makeProfile("ADMIN");
  }, 120_000);

  it("moves lessons and modules, and refuses a non-admin", async () => {
    const { moveLesson, moveModule } =
      await import("@/services/lms/reorder-course-items");
    const c = await makeCourse();

    await moveLesson(admin, c.A3, "up");
    expect(await titles(c.courseId)).toEqual(["A:A1,A3,A2", "B:B1"]);

    // Already first: nothing happens, no error.
    await moveLesson(admin, c.A1, "up");
    expect(await titles(c.courseId)).toEqual(["A:A1,A3,A2", "B:B1"]);

    await moveModule(admin, c.modB, "up");
    expect(await titles(c.courseId)).toEqual(["B:B1", "A:A1,A3,A2"]);

    const member = await makeProfile("USER");
    await expect(moveModule(member, c.modA, "up")).rejects.toThrow(
      "Seul un administrateur peut réorganiser un cours.",
    );
  });

  it("keeps a hidden module listed for the admin only", async () => {
    const c = await makeCourse();
    await localDb
      .update(schema.modules)
      .set({ isActive: false })
      .where(eq(schema.modules.id, c.modB));

    expect(await titles(c.courseId)).toEqual(["A:A1,A2,A3"]);
    expect(await titles(c.courseId, true)).toEqual(["A:A1,A2,A3", "B:B1"]);
  });

  it("computes stats per lesson, leaving admins out", async () => {
    const { getCourseStats } = await import("@/repositories/courses");
    const c = await makeCourse();
    const done = async (userId: string, lessonIds: string[]) =>
      localDb
        .insert(schema.lessonProgress)
        .values(lessonIds.map((lessonId) => ({ userId, lessonId })));

    const alice = await makeProfile("USER");
    const bob = await makeProfile("USER");
    await done(alice, [c.A1, c.A2, c.A3, c.B1]); // finished
    await done(bob, [c.A1]); // dropped after the first lesson
    await done(admin, [c.A1, c.A2]); // preview clicks — not counted

    const stats = await getCourseStats(localDb, c.courseId);
    expect(stats).toMatchObject({
      totalLessons: 4,
      learners: 2,
      finished: 1,
      averagePercent: 63, // (4 + 1) / (2 × 4)
    });
    expect(
      stats!.lessons.map(
        (l: { title: string; completions: number }) =>
          `${l.title}=${l.completions}`,
      ),
    ).toEqual(["A1=2", "A2=1", "A3=1", "B1=1"]);
  });

  it("creates a video lesson before its video exists, and adds the link later", async () => {
    const { createLesson } = await import("@/services/lms/create-lesson");
    const { updateLesson } = await import("@/services/lms/update-lesson");
    const c = await makeCourse();

    const lesson = await createLesson(admin, {
      moduleId: c.modB,
      title: "Séance 1 — Les bases du montage",
      lessonType: "VIDEO",
      videoProvider: "YOUTUBE",
      videoUrl: "  ",
    });
    expect(lesson).toMatchObject({ videoUrl: null, position: 2 });

    const updated = await updateLesson(admin, lesson.id, {
      title: lesson.title,
      lessonType: "VIDEO",
      videoProvider: "OTHER",
      videoUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view",
      isActive: true,
    });
    expect(updated.videoUrl).toBe(
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view",
    );
  });

  it("edits a course's title and description, keeping its public address", async () => {
    const { updateCourseDetails } =
      await import("@/services/lms/update-course-details");
    const [course] = await localDb
      .insert(schema.courses)
      .values({ title: "Ancien titre", slug: "ancien-titre-x1" })
      .returning();

    const updated = await updateCourseDetails(admin, course.id, {
      title: "  Se lancer dans l'e-commerce en Afrique  ",
      description: "  Nouvelle description.  ",
    });
    expect(updated).toMatchObject({
      title: "Se lancer dans l'e-commerce en Afrique",
      description: "Nouvelle description.",
      slug: "ancien-titre-x1",
    });

    const cleared = await updateCourseDetails(admin, course.id, {
      title: updated.title,
      description: "   ",
    });
    expect(cleared.description).toBeNull();

    await expect(
      updateCourseDetails(admin, course.id, { title: "  ", description: null }),
    ).rejects.toThrow("Le titre ne peut pas être vide.");
    const member = await makeProfile("USER");
    await expect(
      updateCourseDetails(member, course.id, { title: "X", description: null }),
    ).rejects.toThrow("Seul un administrateur peut modifier un cours.");
  });

  it("a coming-soon course stays listed but can't be opened by a member", async () => {
    const { updateCourseAvailability } =
      await import("@/services/lms/update-course-availability");
    const { hasCourseAccess, listCoursesForUser } =
      await import("@/repositories/courses");
    const c = await makeCourse();
    await localDb
      .update(schema.courses)
      .set({ status: "PUBLISHED" })
      .where(eq(schema.courses.id, c.courseId));
    const member = await makeProfile("USER");
    const [payment] = await localDb
      .insert(schema.payments)
      .values({
        beneficiaryUserId: member,
        purpose: "SUBSCRIPTION",
        method: "ADMIN_CREDIT",
        amount: 15000,
        status: "CONFIRMED",
        idempotencyKey: `TEST:${randomUUID()}`,
      })
      .returning();
    await localDb.insert(schema.subscriptions).values({
      userId: member,
      paymentId: payment.id,
      expiresAt: new Date(Date.now() + 200 * 86_400_000),
      pricePaid: 15000,
      businessVolume: 15,
    });
    expect(await hasCourseAccess(localDb, member, c.courseId)).toBe(true);

    await updateCourseAvailability(admin, c.courseId, true);
    expect(await hasCourseAccess(localDb, member, c.courseId)).toBe(false);
    expect(await hasCourseAccess(localDb, admin, c.courseId)).toBe(true);
    const listed = (await listCoursesForUser(localDb, member)).find(
      (course: { id: string }) => course.id === c.courseId,
    );
    expect(listed).toMatchObject({ comingSoon: true, accessible: false });
    const forAdmin = (await listCoursesForUser(localDb, admin)).find(
      (course: { id: string }) => course.id === c.courseId,
    );
    expect(forAdmin).toMatchObject({ comingSoon: false, accessible: true });

    await updateCourseAvailability(admin, c.courseId, false);
    expect(await hasCourseAccess(localDb, member, c.courseId)).toBe(true);
    await expect(
      updateCourseAvailability(member, c.courseId, true),
    ).rejects.toThrow("Seul un administrateur");
  });
});
