import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// A level-completion certificate, drawn as a one-page A4 landscape PDF.
// Nothing is stored: the certificate is rebuilt from the member_levels row
// each time it's downloaded, so it exists as soon as the level is
// completed and always carries the member's current name. Reward values
// never appear on it (members only ever see the reward items).

const NAVY = rgb(0x13 / 255, 0x1a / 255, 0x2a / 255);
const ORANGE = rgb(0xe8 / 255, 0x74 / 255, 0x2a / 255);
const GOLD = rgb(0xf5 / 255, 0xa5 / 255, 0x24 / 255);
const MUTED = rgb(0x5a / 255, 0x64 / 255, 0x78 / 255);
const CREAM = rgb(0xfd / 255, 0xfa / 255, 0xf4 / 255);

const WIDTH = 841.89;
const HEIGHT = 595.28;

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

// "KX-N2-1A2B3C4D": stable for a given member_levels row, short enough to
// read out over the phone.
export function certificateReference(memberLevelId: string, levelCode: number) {
  return `KX-N${levelCode}-${memberLevelId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

// The standard PDF fonts only know Latin-1 (WinAnsi): French accents are
// fine, but a name typed with other characters would make pdf-lib throw.
// Those characters fall back to their unaccented form, or are dropped.
function printable(font: PDFFont, text: string): string {
  try {
    font.encodeText(text);
    return text;
  } catch {
    return [...text]
      .map((char) => {
        try {
          font.encodeText(char);
          return char;
        } catch {
          const plain = char.normalize("NFD").replace(/[̀-ͯ]/g, "");
          try {
            font.encodeText(plain);
            return plain;
          } catch {
            return "";
          }
        }
      })
      .join("");
  }
}

export async function renderLevelCertificate(
  input: LevelCertificateInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificat — Niveau ${input.levelCode}`);
  pdf.setAuthor("Kinetix Africa");
  pdf.setCreator("Kinetix Africa");

  const page = pdf.addPage([WIDTH, HEIGHT]);
  const [sans, sansBold, serifBoldItalic, serifItalic] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    pdf.embedFont(StandardFonts.TimesRomanItalic),
  ]);

  const centered = (
    text: string,
    y: number,
    font: PDFFont,
    size: number,
    color = NAVY,
  ) => {
    const safe = printable(font, text);
    page.drawText(safe, {
      x: (WIDTH - font.widthOfTextAtSize(safe, size)) / 2,
      y,
      size,
      font,
      color,
    });
  };

  // Background and frame.
  page.drawRectangle({
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    color: CREAM,
  });
  page.drawRectangle({
    x: 18,
    y: 18,
    width: WIDTH - 36,
    height: HEIGHT - 36,
    borderColor: NAVY,
    borderWidth: 6,
  });
  page.drawRectangle({
    x: 32,
    y: 32,
    width: WIDTH - 64,
    height: HEIGHT - 64,
    borderColor: GOLD,
    borderWidth: 1.2,
  });
  // Corner accents.
  for (const [x, y, dx, dy] of [
    [32, HEIGHT - 32, 1, -1],
    [WIDTH - 32, HEIGHT - 32, -1, -1],
    [32, 32, 1, 1],
    [WIDTH - 32, 32, -1, 1],
  ] as const) {
    page.drawSvgPath(`M 0 0 L ${70 * dx} 0 L 0 ${-70 * dy} Z`, {
      x,
      y,
      color: ORANGE,
    });
  }

  // Logo.
  let top = HEIGHT - 70;
  if (input.logoPng) {
    try {
      const logo = await pdf.embedPng(input.logoPng);
      const scaled = logo.scaleToFit(170, 70);
      page.drawImage(logo, {
        x: (WIDTH - scaled.width) / 2,
        y: top - scaled.height,
        width: scaled.width,
        height: scaled.height,
      });
      top -= scaled.height + 14;
    } catch {
      // An unreadable logo shouldn't cost the member their certificate.
    }
  }

  centered("CERTIFICAT DE RÉUSSITE", top - 34, sansBold, 30);
  page.drawRectangle({
    x: WIDTH / 2 - 60,
    y: top - 50,
    width: 120,
    height: 3,
    color: ORANGE,
  });

  centered(
    "Ce certificat est fièrement décerné à",
    top - 82,
    serifItalic,
    15,
    MUTED,
  );

  // The name: shrinks to fit a long one on the line.
  const name = printable(serifBoldItalic, input.fullName.trim()) || "—";
  let nameSize = 40;
  while (
    nameSize > 20 &&
    serifBoldItalic.widthOfTextAtSize(name, nameSize) > WIDTH - 200
  ) {
    nameSize -= 2;
  }
  centered(name, top - 130, serifBoldItalic, nameSize);
  page.drawLine({
    start: { x: WIDTH / 2 - 220, y: top - 142 },
    end: { x: WIDTH / 2 + 220, y: top - 142 },
    thickness: 0.8,
    color: GOLD,
  });

  centered("pour avoir complété avec succès", top - 172, sans, 13, MUTED);
  centered(
    `le Niveau ${input.levelCode} — ${input.levelName}`,
    top - 200,
    sansBold,
    22,
    ORANGE,
  );
  centered(
    "du Programme Ambassadeur Kinetix Africa",
    top - 224,
    sans,
    13,
    MUTED,
  );
  if (input.isTopLevel) {
    centered(
      "et atteint le rang d'Ancêtre, sommet du plan de progression.",
      top - 246,
      serifItalic,
      13,
      NAVY,
    );
  }

  // Footer: date on the left, issuer on the right, reference in between.
  const footerY = 78;
  const date = input.completedAt.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const footerBlock = (x: number, label: string, value: string) => {
    page.drawLine({
      start: { x: x - 110, y: footerY + 20 },
      end: { x: x + 110, y: footerY + 20 },
      thickness: 0.8,
      color: NAVY,
    });
    const v = printable(sansBold, value);
    page.drawText(v, {
      x: x - sansBold.widthOfTextAtSize(v, 12) / 2,
      y: footerY + 26,
      size: 12,
      font: sansBold,
      color: NAVY,
    });
    page.drawText(label, {
      x: x - sans.widthOfTextAtSize(label, 10) / 2,
      y: footerY + 6,
      size: 10,
      font: sans,
      color: MUTED,
    });
  };
  footerBlock(210, "Date d'obtention", date);
  footerBlock(WIDTH - 210, "Kinetix Africa", "La Direction");

  centered(`N° ${input.reference}`, footerY + 26, sansBold, 10, ORANGE);
  centered(
    "Kinetix Africa est une marque d'EXCELLENCIA GROUP LTD, Londres, Royaume-Uni",
    48,
    sans,
    8,
    MUTED,
  );

  return pdf.save();
}
