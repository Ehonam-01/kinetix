import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "3 caractères minimum")
  .max(20, "20 caractères maximum")
  .regex(/^[a-z0-9_]+$/, "Lettres minuscules, chiffres et _ uniquement");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(120),
  username: usernameSchema,
  email: z.string().trim().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum").max(72),
  // Optional: only the platform root has no sponsor. Empty string (from an
  // untouched form field) is a valid "no sponsor" value, not a validation
  // error — callers should treat "" the same as undefined (both falsy).
  sponsorEmail: z
    .literal("")
    .or(z.string().trim().toLowerCase().email("Email de parrain invalide"))
    .optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Email invalide"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "8 caractères minimum").max(72),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
