import { describe, expect, it } from "vitest";
import { cn, slugify } from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Bienvenue dans le programme")).toBe(
      "bienvenue-dans-le-programme",
    );
  });

  it("collapses runs of non-alphanumeric characters into one dash", () => {
    expect(slugify("Facebook Ads : niveau 1 !!")).toBe("facebook-ads-niveau-1");
  });

  it("trims leading and trailing dashes", () => {
    expect(slugify("--deja-la--")).toBe("deja-la");
  });

  it("folds accented letters to their plain form instead of dropping them", () => {
    expect(slugify("IA Générative : contenu, image et vidéo")).toBe(
      "ia-generative-contenu-image-et-video",
    );
  });
});
