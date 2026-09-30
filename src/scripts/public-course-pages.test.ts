// The public formation pages' data rules, against a disposable pglite
// database (every real migration applied, nothing shared touched): two
// courses with the same title both get created (unique slugs), a course is
// found by slug or by id, and a draft doesn't exist for visitors.
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

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));

describe("public course pages (pglite, no shared DB touched)", () => {
  let admin: string;

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localDb = db;
    await seedBaselineParameters(db);
    admin = randomUUID();
    await client.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [admin]);
    await localDb.insert(schema.profiles).values({
      id: admin,
      username: `admin_${admin.slice(0, 6)}`,
      fullName: "Admin",
      status: "ACTIVE",
      role: "ADMIN",
    });
  }, 120_000);

  it("gives courses with the same title distinct slugs", async () => {
    const { createCourse } = await import("@/services/lms/create-course");
    const a = await createCourse(admin, { title: "Créer sa boutique" });
    const b = await createCourse(admin, { title: "Créer sa boutique" });
    const c = await createCourse(admin, { title: "Créer sa boutique !" });
    expect([a.slug, b.slug, c.slug]).toEqual([
      "creer-sa-boutique",
      "creer-sa-boutique-2",
      "creer-sa-boutique-3",
    ]);
  });

  it("finds a published course by slug or id, never a draft", async () => {
    const { createCourse } = await import("@/services/lms/create-course");
    const { getPublicCourse } = await import("@/repositories/courses");
    const course = await createCourse(admin, { title: "Vendre en ligne" });

    const bySlug = await getPublicCourse(localDb, "vendre-en-ligne");
    const byId = await getPublicCourse(localDb, course.id);
    expect(bySlug?.course.id).toBe(course.id);
    expect(byId?.course.id).toBe(course.id);
    expect(await getPublicCourse(localDb, "nexiste-pas")).toBeNull();

    await localDb
      .update(schema.courses)
      .set({ status: "DRAFT" })
      .where(eq(schema.courses.id, course.id));
    expect(await getPublicCourse(localDb, "vendre-en-ligne")).toBeNull();
    expect(await getPublicCourse(localDb, course.id)).toBeNull();
  });
});
