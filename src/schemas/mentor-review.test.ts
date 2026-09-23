import { describe, expect, it } from "vitest";
import { submitMentorReviewSchema } from "./mentor-review";

const mentorshipId = "9d1e6f2a-3b4c-4d5e-8f6a-1b2c3d4e5f6a";

describe("submitMentorReviewSchema", () => {
  it("accepts a rating with no comment", () => {
    const result = submitMentorReviewSchema.safeParse({ mentorshipId, rating: 5 });
    expect(result.success).toBe(true);
  });

  it("accepts a rating with a comment", () => {
    const result = submitMentorReviewSchema.safeParse({
      mentorshipId,
      rating: 4,
      comment: "Très bon accompagnement.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a rating of 0", () => {
    const result = submitMentorReviewSchema.safeParse({ mentorshipId, rating: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a rating above 5", () => {
    const result = submitMentorReviewSchema.safeParse({ mentorshipId, rating: 6 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    const result = submitMentorReviewSchema.safeParse({ mentorshipId, rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a comment longer than 280 characters", () => {
    const result = submitMentorReviewSchema.safeParse({
      mentorshipId,
      rating: 3,
      comment: "a".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid mentorshipId", () => {
    const result = submitMentorReviewSchema.safeParse({
      mentorshipId: "not-a-uuid",
      rating: 3,
    });
    expect(result.success).toBe(false);
  });
});
