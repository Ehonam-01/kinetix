import { describe, expect, it } from "vitest";
import { isGoalValue } from "@/config/goals";
import { orientationRequestSchema } from "./orientation";

const valid = {
  goal: "ia",
  situation: "etudiant",
  level: "debutant",
  weeklyTime: "2_5h",
  interests: "IA, marketing digital",
  message: "",
};

describe("orientationRequestSchema", () => {
  it("accepts a complete questionnaire", () => {
    expect(orientationRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown goal or an unanswered question", () => {
    expect(
      orientationRequestSchema.safeParse({ ...valid, goal: "pirater" }).success,
    ).toBe(false);
    const missing = orientationRequestSchema.safeParse({
      ...valid,
      situation: "",
    });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toBe(
      "Indique ta situation actuelle.",
    );
  });

  it("requires the interests field", () => {
    expect(
      orientationRequestSchema.safeParse({ ...valid, interests: " " }).success,
    ).toBe(false);
  });
});

describe("isGoalValue", () => {
  it("only accepts the goals of the homepage section", () => {
    expect(isGoalValue("incertain")).toBe(true);
    expect(isGoalValue("autre-chose")).toBe(false);
    expect(isGoalValue(undefined)).toBe(false);
  });
});
