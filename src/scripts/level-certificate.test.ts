// Level certificates: only a completed level has one, and the PDF renders
// whatever the member's name (French accents kept, other scripts degraded
// rather than crashing the download). Disposable pglite database, nothing
// shared touched.
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { getCompletedLevel } from "@/repositories/member-levels";
import {
  certificateReference,
  renderLevelCertificate,
} from "@/services/certificates/level-certificate";
import { createSimulationDb } from "./simulation-helpers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localDb: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any;

describe("level certificates", () => {
  beforeAll(async () => {
    const { client, db } = await createSimulationDb();
    localClient = client;
    localDb = db;
  }, 120_000);

  it("exists only once the level is completed", async () => {
    const userId = randomUUID();
    await localClient.query('INSERT INTO "auth"."users" (id) VALUES ($1);', [
      userId,
    ]);
    await localDb.insert(schema.profiles).values({
      id: userId,
      username: `p_${userId.slice(0, 8)}`,
      fullName: "Afi Kossiwa Mensah",
      status: "ACTIVE",
      role: "USER",
    });
    await localDb.insert(schema.memberLevels).values({ userId, levelCode: 1 });

    expect(await getCompletedLevel(localDb, userId, 1)).toBeNull();
    expect(await getCompletedLevel(localDb, userId, 2)).toBeNull();

    await localDb
      .update(schema.memberLevels)
      .set({ status: "COMPLETED", completedAt: new Date("2026-09-14") })
      .where(
        and(
          eq(schema.memberLevels.userId, userId),
          eq(schema.memberLevels.levelCode, 1),
        ),
      );
    const level = await getCompletedLevel(localDb, userId, 1);
    expect(level).toMatchObject({ levelCode: 1 });
    expect(level!.levelName).toBeTruthy();
    expect(certificateReference(level!.id, 1)).toMatch(/^KX-N1-[0-9A-F]{8}$/);
  });

  it("renders a PDF for accented and non-Latin names", async () => {
    const logoPng = readFileSync(
      path.join(process.cwd(), "public", "logo-horizontal.png"),
    );
    for (const fullName of [
      "Élodie Akouvi Agbéyomé-Kodjo",
      "Ifeoma Nwachukwu 恩瓦楚库",
      "A".repeat(80),
    ]) {
      const pdf = await renderLevelCertificate({
        fullName,
        levelCode: 4,
        levelName: "Platine",
        completedAt: new Date("2026-10-02"),
        reference: "KX-N4-1A2B3C4D",
        isTopLevel: true,
        logoPng,
      });
      expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
      if (process.env.CERTIFICATE_SAMPLE_DIR && fullName.startsWith("É")) {
        await writeFile(
          path.join(process.env.CERTIFICATE_SAMPLE_DIR, "certificat.pdf"),
          pdf,
        );
      }
    }
  });
});
