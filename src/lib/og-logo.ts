import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The horizontal logo as a data URL, for the link-preview images drawn by
// next/og (app/opengraph-image.tsx, formations/[slug]/opengraph-image.tsx).
export async function ogLogoDataUrl() {
  const file = await readFile(
    join(process.cwd(), "public/logo-horizontal.png"),
  );
  return `data:image/png;base64,${file.toString("base64")}`;
}

// Site colors on the previews: night blue and orange.
export const OG_NIGHT = "#0b1d4d";
export const OG_NIGHT_LIGHT = "#123a9c";
export const OG_ORANGE = "#f7a823";
