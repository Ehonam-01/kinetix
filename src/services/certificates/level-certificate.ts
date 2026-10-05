import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

// A level-completion certificate, drawn as a one-page A4 landscape PDF.
// Nothing is stored: the certificate is rebuilt from the member_levels row
// each time it's downloaded, so it exists as soon as the level is
// completed and always carries the member's current name. Reward values
// never appear on it (members only ever see the reward items).
//
// Each level has its own colours (bronze, silver, gold, platinum) on the
// same layout: a dark gradient, a wave edged with the level's metal, a
// medal, the name in a script font.

const WIDTH = 841.89;
const HEIGHT = 595.28;
const LEFT = 60;

export type LevelCertificateInput = {
  fullName: string;
  levelCode: number;
  levelName: string;
  completedAt: Date;
  reference: string;
  // The last level of the plan: the member also becomes an "ancêtre".
  isTopLevel: boolean;
  logoPng?: Uint8Array | null;
};

type Theme = {
  bgTop: string;
  bgBottom: string;
  panel: string;
  shadow: string;
  metalLight: string;
  metal: string;
  metalDark: string;
};

// Keyed by level code. A level beyond these reuses the last theme.
const THEMES: Record<number, Theme> = {
  1: {
    bgTop: "#2b1509",
    bgBottom: "#5a3016",
    panel: "#7a4320",
    shadow: "#1d0e05",
    metalLight: "#f6c08a",
    metal: "#cd7f32",
    metalDark: "#8a4f1c",
  },
  2: {
    bgTop: "#151c25",
    bgBottom: "#36444f",
    panel: "#4b5b6c",
    shadow: "#0d1218",
    metalLight: "#f7f9fb",
    metal: "#c3cad1",
    metalDark: "#7b858f",
  },
  3: {
    bgTop: "#04263f",
    bgBottom: "#0b5583",
    panel: "#106ea6",
    shadow: "#03192a",
    metalLight: "#ffe69a",
    metal: "#d8a93a",
    metalDark: "#9c7417",
  },
  4: {
    bgTop: "#0a0c1a",
    bgBottom: "#262a46",
    panel: "#383f68",
    shadow: "#05060e",
    metalLight: "#ffffff",
    metal: "#d5e0ea",
    metalDark: "#8ea3b8",
  },
};

function themeFor(levelCode: number): Theme {
  const codes = Object.keys(THEMES).map(Number);
  return THEMES[Math.min(Math.max(levelCode, 1), Math.max(...codes))];
}

function hex(color: string): Color {
  const n = parseInt(color.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function mix(a: string, b: string, t: number): Color {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    (((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t) / 255;
  return rgb(channel(16), channel(8), channel(0));
}

// "KX-N2-1A2B3C4D": stable for a given member_levels row, short enough to
// read out over the phone.
export function certificateReference(memberLevelId: string, levelCode: number) {
  return `KX-N${levelCode}-${memberLevelId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// Fonts (SIL Open Font License, see src/assets/fonts/OFL-*.txt), read once
// per server instance. Shipped with the route through next.config.ts's
// outputFileTracingIncludes.
const FONT_FILES = {
  title: "Montserrat-ExtraBold.ttf",
  semibold: "Montserrat-SemiBold.ttf",
  regular: "Montserrat-Regular.ttf",
  script: "GreatVibes-Regular.ttf",
} as const;
type FontKey = keyof typeof FONT_FILES;

let fontBytes: Promise<Record<FontKey, Uint8Array>> | null = null;
function loadFontBytes() {
  fontBytes ??= Promise.all(
    (Object.keys(FONT_FILES) as FontKey[]).map(
      async (key) =>
        [
          key,
          await readFile(
            path.join(process.cwd(), "src", "assets", "fonts", FONT_FILES[key]),
          ),
        ] as const,
    ),
  )
    .then(
      (entries) =>
        Object.fromEntries(entries) as unknown as Record<FontKey, Uint8Array>,
    )
    .catch((err) => {
      fontBytes = null;
      throw err;
    });
  return fontBytes;
}

// A character the font has no glyph for would print as an empty box: it
// falls back to its unaccented form, or is dropped.
function printable(font: PDFFont, text: string): string {
  const available = new Set(font.getCharacterSet());
  return [...text]
    .map((char) => {
      if (available.has(char.codePointAt(0)!)) return char;
      const plain = char.normalize("NFD").replace(/[̀-ͯ]/g, "");
      return [...plain].every((c) => available.has(c.codePointAt(0)!))
        ? plain
        : "";
    })
    .join("");
}

// Coordinates below are measured from the TOP of the page, like the SVG
// paths, and converted here.
function text(
  page: PDFPage,
  value: string,
  options: {
    x: number;
    top: number;
    font: PDFFont;
    size: number;
    color: Color;
    spacing?: number;
    align?: "left" | "right";
    opacity?: number;
  },
) {
  const safe = printable(options.font, value);
  const spacing = options.spacing ?? 0;
  const width =
    options.font.widthOfTextAtSize(safe, options.size) +
    spacing * Math.max(0, [...safe].length - 1);
  let x = options.align === "right" ? options.x - width : options.x;
  const y = HEIGHT - options.top;
  if (spacing === 0) {
    page.drawText(safe, {
      x,
      y,
      size: options.size,
      font: options.font,
      color: options.color,
      opacity: options.opacity,
    });
    return width;
  }
  for (const char of safe) {
    page.drawText(char, {
      x,
      y,
      size: options.size,
      font: options.font,
      color: options.color,
      opacity: options.opacity,
    });
    x += options.font.widthOfTextAtSize(char, options.size) + spacing;
  }
  return width;
}

function wrap(font: PDFFont, value: string, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The wave's lower edge, left to right — shared by the panel above it and
// the metal stroke along it.
const WAVE =
  "C 180 105 330 64 470 70 C 600 75 650 140 700 190 C 745 235 790 268 842 270";
const PANEL = `M 0 100 ${WAVE} L 842 0 L 0 0 Z`;

function drawBackground(page: PDFPage, theme: Theme) {
  // Vertical gradient, drawn as thin bands.
  const bands = 120;
  const bandHeight = HEIGHT / bands;
  for (let i = 0; i < bands; i++) {
    page.drawRectangle({
      x: 0,
      y: HEIGHT - (i + 1) * bandHeight,
      width: WIDTH,
      height: bandHeight + 0.5,
      color: mix(theme.bgTop, theme.bgBottom, i / (bands - 1)),
    });
  }

  // A soft shadow under the wave, then the lighter panel above it.
  for (const [offset, opacity] of [
    [26, 0.25],
    [14, 0.35],
  ] as const) {
    page.drawSvgPath(PANEL, {
      x: 0,
      y: HEIGHT - offset,
      color: hex(theme.shadow),
      opacity,
    });
  }
  page.drawSvgPath(PANEL, { x: 0, y: HEIGHT, color: hex(theme.panel) });

  // The metal edge: a dark, a base and a light stroke for a sheen.
  const edge = `M 0 100 ${WAVE}`;
  for (const [color, width, dy] of [
    [theme.metalDark, 9, 1],
    [theme.metal, 6, 0],
    [theme.metalLight, 1.6, -1.5],
  ] as const) {
    page.drawSvgPath(edge, {
      x: 0,
      y: HEIGHT - dy,
      borderColor: hex(color),
      borderWidth: width,
    });
  }
  // A thin second line, echoing the first.
  page.drawSvgPath(edge, {
    x: 0,
    y: HEIGHT - 20,
    borderColor: hex(theme.metal),
    borderWidth: 1,
    borderOpacity: 0.45,
  });
}

function drawMedal(
  page: PDFPage,
  theme: Theme,
  fonts: Record<FontKey, PDFFont>,
  levelCode: number,
  levelName: string,
) {
  const cx = 735;
  const cy = 118; // from the top
  const y = HEIGHT - cy;

  // Ribbon tails, behind the medal.
  for (const side of [-1, 1]) {
    const s = side;
    page.drawSvgPath(
      `M ${cx + 6 * s} ${cy + 30} L ${cx + 34 * s} ${cy + 36} L ${cx + 44 * s} ${cy + 112} L ${cx + 30 * s} ${cy + 100} L ${cx + 16 * s} ${cy + 114} Z`,
      { x: 0, y: HEIGHT, color: hex(s < 0 ? theme.metal : theme.metalDark) },
    );
  }

  // Scalloped rim.
  const points = 26;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    page.drawCircle({
      x: cx + Math.cos(angle) * 50,
      y: y + Math.sin(angle) * 50,
      size: 8,
      color: hex(theme.metal),
    });
  }
  page.drawCircle({ x: cx, y, size: 51, color: hex(theme.metal) });
  page.drawCircle({ x: cx, y, size: 45, color: hex(theme.metalDark) });
  page.drawCircle({
    x: cx,
    y,
    size: 41,
    color: mix(theme.shadow, "#000000", 0.3),
  });
  page.drawCircle({
    x: cx,
    y,
    size: 37,
    borderColor: hex(theme.metalLight),
    borderWidth: 1,
  });

  const centered = (
    value: string,
    top: number,
    font: PDFFont,
    size: number,
    spacing = 0,
  ) => {
    const safe = printable(font, value);
    const width =
      font.widthOfTextAtSize(safe, size) +
      spacing * Math.max(0, [...safe].length - 1);
    text(page, safe, {
      x: cx - width / 2,
      top,
      font,
      size,
      color: hex(theme.metalLight),
      spacing,
    });
  };
  centered("NIVEAU", cy - 14, fonts.semibold, 7, 1.6);
  centered(String(levelCode), cy + 14, fonts.title, 30);
  let nameSize = 8;
  const name = levelName.toUpperCase();
  while (
    nameSize > 5 &&
    fonts.semibold.widthOfTextAtSize(name, nameSize) > 58
  ) {
    nameSize -= 0.5;
  }
  centered(name, cy + 27, fonts.semibold, nameSize, 1);
}

export async function renderLevelCertificate(
  input: LevelCertificateInput,
): Promise<Uint8Array> {
  const theme = themeFor(input.levelCode);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Certificat — Niveau ${input.levelCode}`);
  pdf.setAuthor("Kinetix Africa");
  pdf.setCreator("Kinetix Africa");

  const bytes = await loadFontBytes();
  const fonts = Object.fromEntries(
    await Promise.all(
      (Object.keys(bytes) as FontKey[]).map(
        async (key) =>
          [key, await pdf.embedFont(bytes[key], { subset: true })] as const,
      ),
    ),
  ) as Record<FontKey, PDFFont>;

  const page = pdf.addPage([WIDTH, HEIGHT]);
  const white = rgb(1, 1, 1);
  drawBackground(page, theme);

  // Logo, on a white plate so its blue stays readable on any background.
  if (input.logoPng) {
    try {
      const logo = await pdf.embedPng(input.logoPng);
      page.drawSvgPath(
        "M 48 22 H 172 Q 182 22 182 32 V 74 Q 182 84 172 84 H 48 Q 38 84 38 74 V 32 Q 38 22 48 22 Z",
        { x: 0, y: HEIGHT, color: white },
      );
      const scaled = logo.scaleToFit(124, 52);
      page.drawImage(logo, {
        x: 110 - scaled.width / 2,
        y: HEIGHT - 53 - scaled.height / 2,
        width: scaled.width,
        height: scaled.height,
      });
    } catch {
      // An unreadable logo shouldn't cost the member their certificate.
    }
  }

  drawMedal(page, theme, fonts, input.levelCode, input.levelName);

  text(page, "CERTIFICAT", {
    x: LEFT - 2,
    top: 206,
    font: fonts.title,
    size: 58,
    color: white,
  });
  text(page, "DE RÉUSSITE", {
    x: LEFT,
    top: 238,
    font: fonts.semibold,
    size: 22,
    color: white,
    spacing: 2.5,
  });
  text(page, "FIÈREMENT DÉCERNÉ À", {
    x: LEFT,
    top: 290,
    font: fonts.semibold,
    size: 12,
    color: hex(theme.metalLight),
    spacing: 3.5,
  });

  // The name: shrinks to fit a long one.
  const name = printable(fonts.script, input.fullName.trim()) || "—";
  let nameSize = 58;
  while (
    nameSize > 26 &&
    fonts.script.widthOfTextAtSize(name, nameSize) > 640
  ) {
    nameSize -= 2;
  }
  text(page, name, {
    x: LEFT,
    top: 352,
    font: fonts.script,
    size: nameSize,
    color: hex(theme.metalLight),
  });
  page.drawLine({
    start: { x: LEFT, y: HEIGHT - 372 },
    end: { x: 560, y: HEIGHT - 372 },
    thickness: 0.8,
    color: white,
    opacity: 0.55,
  });

  text(
    page,
    `NIVEAU ${input.levelCode} — ${input.levelName.toUpperCase()} · PROGRAMME AMBASSADEUR KINETIX AFRICA`,
    {
      x: LEFT,
      top: 394,
      font: fonts.semibold,
      size: 10,
      color: white,
      spacing: 1.2,
    },
  );

  const paragraph =
    `Pour avoir complété avec succès toutes les générations du Niveau ${input.levelCode} — ${input.levelName} ` +
    "du Programme Ambassadeur Kinetix Africa. Ce certificat salue un engagement, " +
    "une persévérance et un leadership remarquables dans le développement de son équipe." +
    (input.isTopLevel
      ? " Ce niveau marque le sommet du plan de progression : le rang d'Ancêtre."
      : "");
  wrap(fonts.regular, paragraph, 10.5, 500).forEach((line, i) => {
    text(page, line, {
      x: LEFT,
      top: 418 + i * 16,
      font: fonts.regular,
      size: 10.5,
      color: white,
      opacity: 0.85,
    });
  });

  // Date and signature.
  const date = input.completedAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  for (const [x, value, label, script] of [
    [LEFT, date, "DATE", false],
    [LEFT + 220, "La Direction", "SIGNATURE", true],
  ] as const) {
    const font = script ? fonts.script : fonts.semibold;
    const size = script ? 24 : 12;
    const width = font.widthOfTextAtSize(value, size);
    text(page, value, {
      x: x + 85 - width / 2,
      top: 528,
      font,
      size,
      color: script ? hex(theme.metalLight) : white,
    });
    page.drawLine({
      start: { x, y: HEIGHT - 536 },
      end: { x: x + 170, y: HEIGHT - 536 },
      thickness: 0.7,
      color: white,
      opacity: 0.6,
    });
    const labelWidth =
      fonts.semibold.widthOfTextAtSize(label, 8) + 2 * (label.length - 1);
    text(page, label, {
      x: x + 85 - labelWidth / 2,
      top: 551,
      font: fonts.semibold,
      size: 8,
      color: white,
      spacing: 2,
      opacity: 0.75,
    });
  }

  text(page, `N° ${input.reference}`, {
    x: WIDTH - 40,
    top: 534,
    font: fonts.semibold,
    size: 9,
    color: hex(theme.metalLight),
    spacing: 0.8,
    align: "right",
  });
  text(page, "Kinetix Africa · EXCELLENCIA GROUP LTD", {
    x: WIDTH - 40,
    top: 550,
    font: fonts.regular,
    size: 7.5,
    color: white,
    align: "right",
    opacity: 0.6,
  });

  return pdf.save();
}
