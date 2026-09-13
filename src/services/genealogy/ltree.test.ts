import { describe, expect, it } from "vitest";
import { childPath, toLtreeLabel } from "./ltree";

describe("toLtreeLabel", () => {
  it("strips hyphens from a UUID to produce a valid ltree label", () => {
    const label = toLtreeLabel("123e4567-e89b-12d3-a456-426614174000");
    expect(label).toBe("123e4567e89b12d3a456426614174000");
    expect(label).toMatch(/^[a-z0-9]+$/i);
  });
});

describe("childPath", () => {
  it("appends the label as a new segment under the parent path", () => {
    expect(childPath("abc", "def")).toBe("abc.def");
  });

  it("uses the label as the whole path when there is no parent (root node)", () => {
    expect(childPath(null, "abc")).toBe("abc");
  });
});
