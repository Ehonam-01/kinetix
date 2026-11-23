import { getVideoEmbedUrl } from "@/lib/video-embed";

// What the admin fills in for a course's public sales page
// (/formations/[slug]). Every part is optional: an empty one isn't shown.
export type CourseSalesPage = {
  previewVideoUrl: string | null;
  learningOutcomes: string[];
  targetAudience: string[];
  faq: { question: string; answer: string }[];
};

export const SALES_PAGE_LIMITS = {
  outcomes: 8,
  audience: 6,
  faq: 10,
  item: 200,
  answer: 1000,
} as const;

// One item per line, blank lines and stray spaces dropped.
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanList(items: string[], max: number, label: string): string[] {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length > max) {
    throw new Error(`${label} : ${max} lignes au plus.`);
  }
  if (cleaned.some((item) => item.length > SALES_PAGE_LIMITS.item)) {
    throw new Error(
      `${label} : ${SALES_PAGE_LIMITS.item} caractères au plus par ligne.`,
    );
  }
  return cleaned;
}

// Checks and tidies what the admin sent. Throws a message the admin can
// read when something is off.
export function normalizeSalesPage(input: CourseSalesPage): CourseSalesPage {
  const url = input.previewVideoUrl?.trim() || null;
  if (url && !getVideoEmbedUrl("YOUTUBE", url)) {
    throw new Error("La vidéo d'aperçu doit être un lien YouTube.");
  }

  const faq = input.faq
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question || item.answer);
  if (faq.length > SALES_PAGE_LIMITS.faq) {
    throw new Error(`FAQ : ${SALES_PAGE_LIMITS.faq} questions au plus.`);
  }
  for (const item of faq) {
    if (!item.question || !item.answer) {
      throw new Error("FAQ : chaque question a besoin de sa réponse.");
    }
    if (item.question.length > SALES_PAGE_LIMITS.item) {
      throw new Error(
        `FAQ : ${SALES_PAGE_LIMITS.item} caractères au plus par question.`,
      );
    }
    if (item.answer.length > SALES_PAGE_LIMITS.answer) {
      throw new Error(
        `FAQ : ${SALES_PAGE_LIMITS.answer} caractères au plus par réponse.`,
      );
    }
  }

  return {
    previewVideoUrl: url,
    learningOutcomes: cleanList(
      input.learningOutcomes,
      SALES_PAGE_LIMITS.outcomes,
      "Ce que tu vas apprendre",
    ),
    targetAudience: cleanList(
      input.targetAudience,
      SALES_PAGE_LIMITS.audience,
      "Pour qui",
    ),
    faq,
  };
}
