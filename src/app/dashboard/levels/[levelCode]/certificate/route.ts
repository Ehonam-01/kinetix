import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import {
  getCompletedLevel,
  getTopLevelCode,
} from "@/repositories/member-levels";
import { requireUser } from "@/services/auth/current-user";
import {
  certificateReference,
  renderLevelCertificate,
} from "@/services/certificates/level-certificate";

// The logo is shipped with this function through next.config.ts's
// outputFileTracingIncludes: public/ files are served by the CDN, not
// bundled with server code.
async function readLogo(): Promise<Uint8Array | null> {
  try {
    return await readFile(
      path.join(process.cwd(), "public", "logo-horizontal.png"),
    );
  } catch {
    return null;
  }
}

// A member's own certificate for a level they completed — anyone else's
// (or a level not completed yet) is a 404. Earned once, it stays
// downloadable even if the subscription later lapses.
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/dashboard/levels/[levelCode]/certificate">,
) {
  const { levelCode: raw } = await ctx.params;
  const { profile } = await requireUser();

  const levelCode = Number(raw);
  if (!Number.isInteger(levelCode) || levelCode < 1) {
    return new Response("Niveau inconnu.", { status: 404 });
  }

  const level = await getCompletedLevel(db, profile.id, levelCode);
  if (!level) {
    return new Response("Ce niveau n'est pas encore complété.", {
      status: 404,
    });
  }

  const [topLevelCode, logoPng] = await Promise.all([
    getTopLevelCode(db),
    readLogo(),
  ]);
  const pdf = await renderLevelCertificate({
    fullName: profile.fullName,
    levelCode: level.levelCode,
    levelName: level.levelName,
    completedAt: level.completedAt,
    reference: certificateReference(level.id, level.levelCode),
    isTopLevel: level.levelCode >= topLevelCode,
    logoPng,
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificat-niveau-${level.levelCode}-kinetix.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
