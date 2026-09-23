import { z } from "zod";

export const submitMentorReviewSchema = z.object({
  mentorshipId: z.string().uuid(),
  rating: z.number().int().min(1, "Choisissez une note.").max(5),
  comment: z
    .string()
    .trim()
    .max(280, "280 caractères maximum")
    .optional()
    .or(z.literal("")),
});
export type SubmitMentorReviewInput = z.infer<typeof submitMentorReviewSchema>;
