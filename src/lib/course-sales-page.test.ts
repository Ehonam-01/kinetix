import { describe, expect, it } from "vitest";
import { normalizeSalesPage, splitLines } from "./course-sales-page";

const EMPTY = {
  previewVideoUrl: null,
  learningOutcomes: [],
  targetAudience: [],
  faq: [],
};

describe("course sales page", () => {
  it("splits one item per line, dropping blank lines", () => {
    expect(splitLines("  Un \r\n\n Deux\n   \n")).toEqual(["Un", "Deux"]);
  });

  it("tidies what the admin typed", () => {
    expect(
      normalizeSalesPage({
        previewVideoUrl: "  https://youtu.be/abc123  ",
        learningOutcomes: [" Écrire un prompt ", ""],
        targetAudience: [],
        faq: [
          { question: " Faut-il un ordinateur ? ", answer: " Non. " },
          { question: "", answer: "" },
        ],
      }),
    ).toEqual({
      previewVideoUrl: "https://youtu.be/abc123",
      learningOutcomes: ["Écrire un prompt"],
      targetAudience: [],
      faq: [{ question: "Faut-il un ordinateur ?", answer: "Non." }],
    });
    expect(normalizeSalesPage({ ...EMPTY, previewVideoUrl: "  " })).toEqual(
      EMPTY,
    );
  });

  it("only takes a YouTube link for the preview video", () => {
    expect(() =>
      normalizeSalesPage({ ...EMPTY, previewVideoUrl: "https://vimeo.com/1" }),
    ).toThrow("lien YouTube");
  });

  it("refuses a question without its answer, and too many lines", () => {
    expect(() =>
      normalizeSalesPage({
        ...EMPTY,
        faq: [{ question: "Combien de temps ?", answer: " " }],
      }),
    ).toThrow("sa réponse");
    expect(() =>
      normalizeSalesPage({
        ...EMPTY,
        learningOutcomes: Array.from({ length: 9 }, (_, i) => `Point ${i}`),
      }),
    ).toThrow("8 lignes au plus");
  });
});
