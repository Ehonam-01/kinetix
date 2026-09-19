import { z } from "zod";
import { GOAL_OPTIONS } from "@/config/goals";

const GOAL_VALUES = GOAL_OPTIONS.map((g) => g.value) as [string, ...string[]];

export const updateCommunityProfileSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(280, "280 caractères maximum")
    .optional()
    .or(z.literal("")),
  goal: z.enum(GOAL_VALUES).optional().or(z.literal("")),
  // A plain comma-separated field in the UI (no tag-chip component built
  // yet) — split client-side before this ever reaches the schema, so this
  // just validates the resulting list: a handful of short tags, not a
  // paragraph pasted by mistake.
  skills: z
    .array(z.string().trim().min(1).max(30))
    .max(8, "8 compétences maximum"),
  directoryVisible: z.boolean(),
});
export type UpdateCommunityProfileInput = z.infer<
  typeof updateCommunityProfileSchema
>;
