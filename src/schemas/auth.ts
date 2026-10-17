import { z } from "zod";
import { toWhatsappDigits, WHATSAPP_FORMAT_ERROR } from "@/lib/whatsapp";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "3 caractères minimum")
  .max(20, "20 caractères maximum")
  .regex(/^[a-z0-9_]+$/, "Lettres minuscules, chiffres et _ uniquement");

export const registerSchema = z
  .object({
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
    // The sponsor's pseudo — or, for someone who came to the site on their
    // own, the explicit "Je n'ai pas de parrain" box (noSponsor): they're
    // then attached to the platform's own account, the root of the network
    // (services/auth/register.ts). One of the two is required (refine below):
    // an empty field alone isn't enough, so a member can't later claim a
    // signup they forgot to tell their contact to name them in — the new
    // member declared having no sponsor. It used to be mandatory, which left
    // those visitors writing to support just to get a pseudo.
    sponsorUsername: usernameSchema.optional().or(z.literal("")),
    noSponsor: z.boolean().optional(),
    // "Devenir ambassadeur" checkbox (register-form.tsx) — an intent captured
    // now, acted on later once the subscription payment actually confirms
    // (services/subscriptions/confirm-subscription-payment.ts): payment is
    // mandatory before anyone can join the program.
    wantsAmbassador: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.sponsorUsername && !data.noSponsor) {
      ctx.addIssue({
        code: "custom",
        path: ["sponsorUsername"],
        message:
          "Indique le pseudo de ton parrain, ou coche « Je n'ai pas de parrain ».",
      });
    }
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
