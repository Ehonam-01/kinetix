import { describe, expect, it } from "vitest";
import { levelCommissionDedupeKey } from "./dedupe-keys";

describe("levelCommissionDedupeKey", () => {
  it("is unique per (user, level, generation)", () => {
    const a = levelCommissionDedupeKey("u1", 2, 1);
    const b = levelCommissionDedupeKey("u1", 2, 2);
    const c = levelCommissionDedupeKey("u1", 3, 1);
    const d = levelCommissionDedupeKey("u2", 2, 1);
    expect(new Set([a, b, c, d]).size).toBe(4);
  });

  it("is stable across calls with the same arguments", () => {
    expect(levelCommissionDedupeKey("u1", 2, 1)).toBe(
      levelCommissionDedupeKey("u1", 2, 1),
    );
  });
});
