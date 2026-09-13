import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "./binary-nodes";

describe("escapeLikePattern", () => {
  it("leaves a plain alphanumeric string untouched", () => {
    expect(escapeLikePattern("demo123")).toBe("demo123");
  });

  it("escapes underscores so they match literally instead of any single character", () => {
    expect(escapeLikePattern("demo_g1_a")).toBe("demo\\_g1\\_a");
  });

  it("escapes percent signs so they match literally instead of any run of characters", () => {
    expect(escapeLikePattern("100%sure")).toBe("100\\%sure");
  });

  it("escapes a literal backslash first, so it isn't consumed as part of a later escape", () => {
    expect(escapeLikePattern("a\\_b")).toBe("a\\\\\\_b");
  });

  it("escapes every wildcard occurrence, not just the first", () => {
    // Regression for the real bug: an unescaped "demo_l2_d5_" (two
    // underscores) let ILIKE match usernames shaped like "demoXl2Xd5X...",
    // pulling in far more rows than the literal prefix intended.
    expect(escapeLikePattern("demo_l2_d5_")).toBe("demo\\_l2\\_d5\\_");
  });
});
