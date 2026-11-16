// The participants' testimonials on the workshop's sales page
// (services/workshops/testimonials.ts), against a disposable pglite
// database with every real migration applied: added by an admin only,
// shown in their order once published, hidden or removed.
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
// Screenshots go to Supabase Storage, not reached here.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

async function makeProfile(role: "USER" | "ADMIN") {
  const id = randomUUID();
  await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [id]);
  await localDb.insert(schema.profiles).values({
    id,
    username: `p_${id.slice(0, 8)}`,
    fullName: "Profil test",
    role,
  });
  return id;
}

describe("workshop testimonials (pglite)", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
    await seedBaselineParameters(db);
  }, 120_000);

  it("an admin adds them; the page shows the published ones, in order", async () => {
    const {
      addTextTestimonial,
      deleteTestimonial,
      listTestimonials,
      moveTestimonial,
      setTestimonialPublished,
    } = await import("@/services/workshops/testimonials");
    const { getWorkshop } = await import("@/repositories/workshops");
    const admin = await makeProfile("ADMIN");
    const page = await getWorkshop(localDb);
    const published = async () =>
      (await listTestimonials(localDb, page.id, { publishedOnly: true })).map(
        (t: { authorName: string | null }) => t.authorName,
      );

    const ama = await addTextTestimonial(admin, {
      authorName: "Ama K.",
      authorDetail: "Commerçante, Lomé",
      body: "J'ai fait ma première pub pour ma boutique le jour même.",
    });
    await addTextTestimonial(admin, {
      authorName: "Kofi",
      authorDetail: "",
      body: "Très concret, on repart avec une vraie vidéo terminée.",
    });
    expect(await published()).toEqual(["Ama K.", "Kofi"]);
    expect(ama.authorDetail).toBe("Commerçante, Lomé");

    await moveTestimonial(admin, ama.id, "down");
    expect(await published()).toEqual(["Kofi", "Ama K."]);
    // Already last: nothing moves.
    await moveTestimonial(admin, ama.id, "down");
    expect(await published()).toEqual(["Kofi", "Ama K."]);

    await setTestimonialPublished(admin, ama.id, false);
    expect(await published()).toEqual(["Kofi"]);
    expect(
      await listTestimonials(localDb, page.id, { publishedOnly: false }),
    ).toHaveLength(2);

    await deleteTestimonial(admin, ama.id);
    expect(
      await localDb.query.workshopTestimonials.findFirst({
        where: eq(schema.workshopTestimonials.id, ama.id),
      }),
    ).toBeUndefined();
  });

  it("refuses a non-admin and an empty review", async () => {
    const { addTextTestimonial } =
      await import("@/services/workshops/testimonials");
    await expect(
      addTextTestimonial(await makeProfile("USER"), {
        authorName: "Intrus",
        authorDetail: "",
        body: "Un faux témoignage ajouté sans droit.",
      }),
    ).rejects.toThrow("Seul un administrateur");
    await expect(
      addTextTestimonial(await makeProfile("ADMIN"), {
        authorName: "Esi",
        authorDetail: "",
        body: "Bien",
      }),
    ).rejects.toThrow("trop court");
  });
});
