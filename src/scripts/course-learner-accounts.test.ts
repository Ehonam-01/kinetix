// Selling a course on its own, step 1 (explicit user decision): a price per
// course set by the admin, and a "learner" account that only reaches the
// courses it owns. Against a disposable pglite database with every real
// migration applied; nothing shared is touched.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  DASHBOARD_NAV_ITEMS,
  findDashboardSectionLabel,
} from "@/app/dashboard/nav-items";
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

async function makeProfile(
  label: string,
  values: Partial<typeof schema.profiles.$inferInsert> = {},
) {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 6)}`,
    fullName: `Profil ${label}`,
    ...values,
  });
  return id;
}

async function makeCourse(title: string) {
  const [course] = await localDb
    .insert(schema.courses)
    .values({ title, status: "PUBLISHED" })
    .returning();
  return course.id as string;
}

// A course bought on its own: a confirmed payment and its sale.
async function buy(buyerUserId: string, courseId: string, price: number) {
  const [payment] = await localDb
    .insert(schema.payments)
    .values({
      beneficiaryUserId: buyerUserId,
      purpose: "COURSE_PURCHASE",
      method: "MOBILE_MONEY",
      amount: price,
      status: "CONFIRMED",
      idempotencyKey: `TEST:${randomUUID()}`,
    })
    .returning();
  await localDb.insert(schema.sales).values({
    buyerUserId,
    courseId,
    paymentId: payment.id,
    pricePaid: price,
    businessVolume: 0,
  });
}

describe("course sold on its own: price and learner accounts (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("a new profile is a member; a learner is told apart", async () => {
    const member = await makeProfile("membre");
    const learner = await makeProfile("apprenant", { accountType: "LEARNER" });
    const rows = await localDb.query.profiles.findMany();
    const typeOf = (id: string) =>
      rows.find((r: { id: string }) => r.id === id).accountType;
    expect(typeOf(member)).toBe("MEMBER");
    expect(typeOf(learner)).toBe("LEARNER");
  });

  it("the admin sets a price per course, apart from the price shown", async () => {
    const { updateCoursePricing } =
      await import("@/services/lms/update-course-pricing");
    const admin = await makeProfile("admin", { role: "ADMIN" });
    const courseId = await makeCourse("Montage vidéo");

    await updateCoursePricing(admin, courseId, {
      price: 55_000,
      salePrice: 15_000,
      category: "vidéo",
    });
    const course = await localDb.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });
    expect(course).toMatchObject({ price: 55_000, salePrice: 15_000 });

    // Emptied: no longer sold on its own; the price shown stays.
    await updateCoursePricing(admin, courseId, {
      price: 55_000,
      salePrice: null,
      category: "vidéo",
    });
    expect(
      (
        await localDb.query.courses.findFirst({
          where: eq(schema.courses.id, courseId),
        })
      ).salePrice,
    ).toBeNull();

    await expect(
      updateCoursePricing(admin, courseId, {
        price: null,
        salePrice: 50,
        category: null,
      }),
    ).rejects.toThrow("au moins 100 F");
    await expect(
      updateCoursePricing(admin, courseId, {
        price: null,
        salePrice: 1500.5,
        category: null,
      }),
    ).rejects.toThrow("nombre entier");
    await expect(
      updateCoursePricing(await makeProfile("intrus"), courseId, {
        price: null,
        salePrice: 15_000,
        category: null,
      }),
    ).rejects.toThrow("Seul un administrateur");
  });

  it("a learner opens the courses bought, and only those", async () => {
    const { hasCourseAccess, listCoursesForUser } =
      await import("@/repositories/courses");
    const learner = await makeProfile("eleve", { accountType: "LEARNER" });
    const bought = await makeCourse("Achetée");
    const other = await makeCourse("Pas achetée");
    await buy(learner, bought, 15_000);

    expect(await hasCourseAccess(localDb, learner, bought)).toBe(true);
    expect(await hasCourseAccess(localDb, learner, other)).toBe(false);
    const listed = await listCoursesForUser(localDb, learner);
    const accessible = listed
      .filter((c: { accessible: boolean }) => c.accessible)
      .map((c: { id: string }) => c.id);
    expect(accessible).toEqual([bought]);
  });

  it("a learner's menu: their courses, support and settings only", () => {
    const learnerItems = DASHBOARD_NAV_ITEMS.filter((item) => item.learner);
    expect(learnerItems.map((item) => item.href)).toEqual([
      "/dashboard/courses",
      "/dashboard/support",
      "/dashboard/settings",
    ]);
    expect(findDashboardSectionLabel("/dashboard/courses/abc", true)).toBe(
      "Mes formations",
    );
    expect(findDashboardSectionLabel("/dashboard/courses/abc")).toBe("Cours");
  });
});
