// Becoming a trainer, against a disposable pglite database with every real
// migration applied: a member applies once, an admin approves or refuses
// with a reason, a refused member can apply again, only an admin decides,
// and the member is emailed the decision.
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
const sentEmails: { to: string; subject: string; html: string }[] = [];
vi.mock("@/services/notifications/resend-email", () => ({
  resendEmailProvider: {
    sendEmail: async (input: { to: string; subject: string; html: string }) => {
      sentEmails.push(input);
    },
  },
}));
process.env.SITE_URL ??= "https://kinetix.example";

async function makeProfile(label: string, role: "USER" | "ADMIN" = "USER") {
  const id = randomUUID();
  await localClient.query(
    'INSERT INTO "auth"."users" (id, email) VALUES ($1, $2);',
    [id, `${label}@example.test`],
  );
  await localDb.insert(schema.profiles).values({
    id,
    username: `${label}_${id.slice(0, 4)}`,
    fullName: `${label} Test`,
    status: "ACTIVE",
    role,
  });
  return id;
}

const application = {
  domain: "Marketing digital",
  courseTitle: "Vendre sur WhatsApp Business",
  courseOutline:
    "Créer son catalogue, répondre aux clients, relancer, encaisser par mobile money.",
  experience:
    "Cinq ans de vente en ligne, deux boutiques lancées, ateliers animés pour des commerçants.",
  sampleUrl: "",
};

describe("trainer applications (pglite)", () => {
  let admin: string;

  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await client.exec('ALTER TABLE "auth"."users" ADD COLUMN email text;');
    admin = await makeProfile("admin", "ADMIN");
  }, 120_000);

  it("takes one application at a time, and an admin approves it", async () => {
    const svc = await import("@/services/trainers/trainer-requests");
    const member = await makeProfile("afi");

    const request = await svc.requestTrainerStatus(member, application);
    expect(request.status).toBe("PENDING_REVIEW");
    await expect(svc.requestTrainerStatus(member, application)).rejects.toThrow(
      "déjà en cours",
    );

    const { pending } = await svc.listTrainerRequestsForAdmin();
    expect(pending.map((p) => p.request.id)).toContain(request.id);

    await svc.approveTrainerRequest(admin, request.id);
    expect((await svc.findTrainerProfileByUserId(member))?.status).toBe(
      "APPROVED",
    );
    await expect(svc.approveTrainerRequest(admin, request.id)).rejects.toThrow(
      "plus en attente",
    );

    await svc.sendTrainerDecisionEmail(request.id);
    expect(sentEmails.at(-1)).toMatchObject({
      to: "afi@example.test",
      subject: "Ta candidature de formateur est acceptée",
    });
  });

  it("refuses with a reason, then lets the member apply again", async () => {
    const svc = await import("@/services/trainers/trainer-requests");
    const member = await makeProfile("kofi");
    const request = await svc.requestTrainerStatus(member, application);

    expect(() => svc.rejectTrainerRequest(admin, request.id, " ")).toThrow(
      "motif",
    );
    await svc.rejectTrainerRequest(admin, request.id, "Programme trop court");
    await svc.sendTrainerDecisionEmail(request.id);
    expect(sentEmails.at(-1)?.html).toContain("Programme trop court");

    const again = await svc.requestTrainerStatus(member, {
      ...application,
      courseOutline: `${application.courseOutline} Plus un module sur la publicité.`,
    });
    expect(again.id).toBe(request.id);
    expect(again.status).toBe("PENDING_REVIEW");
    expect(again.rejectionReason).toBeNull();
  });

  it("only lets an admin decide", async () => {
    const svc = await import("@/services/trainers/trainer-requests");
    const member = await makeProfile("ama");
    const other = await makeProfile("yao");
    const request = await svc.requestTrainerStatus(member, application);
    await expect(svc.approveTrainerRequest(other, request.id)).rejects.toThrow(
      "Seul un administrateur",
    );
  });

  it("validates the application", async () => {
    const { trainerRequestSchema } = await import("@/schemas/trainer");
    expect(trainerRequestSchema.safeParse(application).success).toBe(true);
    expect(
      trainerRequestSchema.safeParse({ ...application, courseOutline: "court" })
        .success,
    ).toBe(false);
    expect(
      trainerRequestSchema.safeParse({
        ...application,
        sampleUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      trainerRequestSchema.safeParse({
        ...application,
        sampleUrl: "https://www.linkedin.com/in/afi",
      }).success,
    ).toBe(true);
  });
});
