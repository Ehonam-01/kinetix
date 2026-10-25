import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .max(300, "300 caractères maximum")
  .refine(
    (v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v),
    "Lien invalide : il doit commencer par https://",
  );

// The application to become a trainer (dashboard/become-trainer).
export const trainerRequestSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(2, "Indique ton domaine.")
    .max(60, "60 caractères maximum"),
  courseTitle: z
    .string()
    .trim()
    .min(5, "Donne un titre à la formation que tu proposes.")
    .max(120, "120 caractères maximum"),
  courseOutline: z
    .string()
    .trim()
    .min(30, "Décris en quelques lignes ce que la formation apprendrait.")
    .max(2000, "2 000 caractères maximum"),
  experience: z
    .string()
    .trim()
    .min(30, "Présente ton expérience en quelques lignes.")
    .max(1500, "1 500 caractères maximum"),
  sampleUrl: optionalUrl.optional().or(z.literal("")),
});
export type TrainerRequestInput = z.infer<typeof trainerRequestSchema>;
