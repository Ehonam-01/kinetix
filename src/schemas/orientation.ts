import { z } from "zod";
import { GOAL_OPTIONS } from "@/config/goals";
import {
  LEVEL_OPTIONS,
  SITUATION_OPTIONS,
  WEEKLY_TIME_OPTIONS,
} from "@/config/orientation";

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

export const orientationRequestSchema = z.object({
  goal: z.enum(values(GOAL_OPTIONS), { message: "Choisis ton objectif." }),
  situation: z.enum(values(SITUATION_OPTIONS), {
    message: "Indique ta situation actuelle.",
  }),
  level: z.enum(values(LEVEL_OPTIONS), { message: "Indique ton niveau." }),
  weeklyTime: z.enum(values(WEEKLY_TIME_OPTIONS), {
    message: "Indique le temps dont tu disposes.",
  }),
  interests: z
    .string()
    .trim()
    .min(3, "Dis-nous quels domaines t'intéressent.")
    .max(200, "200 caractères maximum"),
  message: z
    .string()
    .trim()
    .max(1000, "1 000 caractères maximum")
    .optional()
    .or(z.literal("")),
});
export type OrientationRequestInput = z.infer<typeof orientationRequestSchema>;
