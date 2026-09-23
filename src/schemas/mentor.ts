import { z } from "zod";

// category isn't a z.enum against listDistinctCourseCategories: that list
// is admin-typed free text on courses (db/schema/courses.ts) and changes
// whenever a course is created/edited, so baking it into a fixed union here
// would drift out of sync — the picker itself constrains the choice
// client-side, this just guards against an empty/oversized submission.
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
