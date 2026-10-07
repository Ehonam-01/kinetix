import { z } from "zod";
import { toWhatsappDigits, WHATSAPP_FORMAT_ERROR } from "@/lib/whatsapp";

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
  // Stored as international digits (lib/whatsapp.ts); shown to the
  // member's upline so their sponsors can reach them.
  whatsapp: z.string().transform((value, ctx) => {
    const digits = toWhatsappDigits(value);
    if (!digits) {
      ctx.addIssue({ code: "custom", message: WHATSAPP_FORMAT_ERROR });
      return z.NEVER;
    }
    return digits;
  }),
  password: z.string().min(8, "8 caractères minimum").max(72),
  // Mandatory — business decision: every new member must be sponsored by an
  // existing one, no organic/unsponsored signups (the platform's own root
  // account predates this rule and isn't affected). Identified by pseudo,
  // not email (section: registration form) — the same handle a referral
  // link already uses, and the one a new member is actually likely to know
  // off the top of their head.
  sponsorUsername: usernameSchema,
  // "Devenir ambassadeur" checkbox (register-form.tsx) — an intent captured
  // now, acted on later once the subscription payment actually confirms
  // (services/subscriptions/confirm-subscription-payment.ts): payment is
  // mandatory before anyone can join the program.
  wantsAmbassador: z.boolean().optional(),
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

// Settings-page password change for an already-signed-in member — unlike
// the recovery-link flow above, it requires the current password, so a
// hijacked session or an unattended browser can't lock the owner out of an
// account holding a real wallet balance (security audit M6).
export const changePasswordSchema = resetPasswordSchema.extend({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
