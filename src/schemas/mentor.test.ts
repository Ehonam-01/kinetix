import { describe, expect, it } from "vitest";
import { requestMentorStatusSchema } from "./mentor";

describe("requestMentorStatusSchema", () => {
  it("accepts a category with no pitch", () => {
    const result = requestMentorStatusSchema.safeParse({
      category: "Marketing digital",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a category with a pitch", () => {
    const result = requestMentorStatusSchema.safeParse({
      category: "Marketing digital",
      pitch: "5 ans d'expérience en growth marketing.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty category", () => {
    const result = requestMentorStatusSchema.safeParse({ category: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing category", () => {
    const result = requestMentorStatusSchema.safeParse({ pitch: "Bonjour" });
    expect(result.success).toBe(false);
  });

  it("rejects a pitch longer than 280 characters", () => {
    const result = requestMentorStatusSchema.safeParse({
      category: "Marketing digital",
      pitch: "a".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("trims the category", () => {
    const result = requestMentorStatusSchema.parse({
      category: "  Marketing digital  ",
    });
    expect(result.category).toBe("Marketing digital");
  });
});
