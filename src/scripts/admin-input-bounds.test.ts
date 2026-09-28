// Admin input bounds (security audit L8) through the real admin services,
// against a disposable pglite database — nothing shared is touched.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createSimulationDb } from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

vi.mock("@/db/client", () => ({
  get db() {
    return localDb;
  },
}));
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: { sendEmail: async () => {} },
}));

async function makeProfile(role: "ADMIN" | "USER") {
  const id = randomUUID();
  const username = `${role.toLowerCase()}_${id.slice(0, 6)}`;
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, `${username}@example.test`],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username,
    fullName: `Profil ${role}`,
    status: "ACTIVE",
    role,
  });
  return { id, username };
}

describe("admin input bounds (pglite, no shared DB touched)", () => {
  let adminId: string;

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    adminId = (await makeProfile("ADMIN")).id;
  }, 120_000);

  it("commission rates in percent are capped at 100 % (10 000 basis points)", async () => {
    const { createDirectSaleCommissionRule } = await import(
      "@/services/admin/create-direct-sale-rule"
    );
    const { createGenerationCommissionRule } = await import(
      "@/services/admin/create-generation-rule"
    );
    await expect(
      createDirectSaleCommissionRule(adminId, {
        commissionType: "PERCENTAGE",
        rate: 10_001,
      }),
    ).rejects.toThrow("100 %");
    await expect(
      createGenerationCommissionRule(adminId, {
        levelCode: 2,
        generation: 1,
        commissionType: "BV_PERCENTAGE",
        rate: 500_000,
        requirePresence: true,
      }),
    ).rejects.toThrow("100 %");

    // Exactly 100 % and a large FIXED amount are still accepted.
    await expect(
      createDirectSaleCommissionRule(adminId, {
        commissionType: "PERCENTAGE",
        rate: 10_000,
      }),
    ).resolves.toBeTruthy();
    await expect(
      createDirectSaleCommissionRule(adminId, {
        commissionType: "FIXED",
        rate: 50_000,
        category: "fixe",
      }),
    ).resolves.toBeTruthy();
  });

  it("the subscription price must stay between 100 and 1 000 000 F", async () => {
    const { updateParameter } = await import(
      "@/services/admin/update-parameter"
    );
    await expect(
      updateParameter(adminId, "subscription.price_in_cfa", 0),
    ).rejects.toThrow("entre 100 et 1");
    await expect(
      updateParameter(adminId, "subscription.price_in_cfa", 1_000_001),
    ).rejects.toThrow("entre 100 et 1");
    await expect(
      updateParameter(adminId, "subscription.price_in_cfa", 15_000),
    ).resolves.not.toThrow();
    // Other parameters keep their own rules (0 is still a valid minimum).
    await expect(
      updateParameter(adminId, "withdrawal.minimum_amount", 0),
    ).resolves.not.toThrow();
  });

  it("an admin recharge is capped at 1 000 000 F", async () => {
    const { initiateAdminRecharge } = await import(
      "@/services/admin/initiate-recharge"
    );
    const member = await makeProfile("USER");
    await expect(
      initiateAdminRecharge(adminId, member.username, 1_000_001),
    ).rejects.toThrow("Une recharge ne peut pas dépasser");
    await expect(
      initiateAdminRecharge(adminId, member.username, 1_000_000),
    ).resolves.toBeTruthy();
  });

  it("texts are length-limited, with room for full lesson articles", async () => {
    const { createCourse } = await import("@/services/lms/create-course");
    const { createModule } = await import("@/services/lms/create-module");
    const { createLesson } = await import("@/services/lms/create-lesson");

    await expect(
      createCourse(adminId, { title: "x".repeat(201) }),
    ).rejects.toThrow("200 caractères maximum");
    await expect(
      createCourse(adminId, { title: "Cours", description: "x".repeat(2001) }),
    ).rejects.toThrow("Description");

    const course = await createCourse(adminId, { title: "Cours valide" });
    const courseModule = await createModule(adminId, {
      courseId: course.id,
      title: "Module 1",
    });
    // A real article (10 000 characters) is fine; 50 001 is not.
    await expect(
      createLesson(adminId, {
        moduleId: courseModule.id,
        title: "Leçon longue",
        lessonType: "TEXT",
        content: "Paragraphe. ".repeat(850),
      }),
    ).resolves.toBeTruthy();
    await expect(
      createLesson(adminId, {
        moduleId: courseModule.id,
        title: "Leçon trop longue",
        lessonType: "TEXT",
        content: "x".repeat(50_001),
      }),
    ).rejects.toThrow("Contenu de la leçon");
  });
});
