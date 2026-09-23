import { z } from "zod";

// category is free text the member types themselves, not a fixed enum —
// a mentor's expertise doesn't have to match an existing course category.
export const requestMentorStatusSchema = z.object({
  category: z.string().trim().min(1, "Choisissez un domaine.").max(60),
  pitch: z
    .string()
    .trim()
    .max(280, "280 caractères maximum")
    .optional()
    .or(z.literal("")),
});
export type RequestMentorStatusInput = z.infer<
  typeof requestMentorStatusSchema
>;
