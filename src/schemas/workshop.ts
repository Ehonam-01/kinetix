import { z } from "zod";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { toWhatsappDigits, WHATSAPP_FORMAT_ERROR } from "@/lib/whatsapp";

// A Togolese number typed without its code ("90 00 00 00") is the usual case
// on this page: the workshop is in Lomé.
export function toWorkshopPhone(input: string): string | null {
  const digits = toWhatsappDigits(input);
  if (!digits) return null;
  return digits.length === 8 ? `228${digits}` : digits;
}

const phoneField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const phone = toWorkshopPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: WHATSAPP_FORMAT_ERROR });
      return z.NEVER;
    }
    return phone;
  });

export const workshopRegistrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Indique ton nom complet.")
    .max(120, "Ce nom est trop long."),
  whatsapp: phoneField,
  email: z
    .union([z.literal(""), z.email("Adresse e-mail invalide.")])
    .transform((value) => value || null),
  city: z
    .string()
    .trim()
    .min(2, "Indique ta ville.")
    .max(80, "Ce nom de ville est trop long."),
  operator: z.enum(["TOGOCELL", "MOOV_MONEY"], {
    error: "Choisis ton opérateur Mobile Money.",
  }),
  // Blank: the WhatsApp number pays.
  paymentPhone: z.union([z.literal(""), phoneField]),
});

export type WorkshopRegistrationInput = z.input<
  typeof workshopRegistrationSchema
>;

export const workshopSettingsSchema = z.object({
  priceCfa: z.coerce.number().int().min(100).max(1_000_000),
  regularPriceCfa: z.coerce.number().int().min(0).max(10_000_000),
  capacity: z.coerce.number().int().min(1).max(100_000),
  venue: z.string().trim().min(3).max(300),
  whatsappGroupUrl: z
    .string()
    .trim()
    .regex(
      /^(https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+\/?(\?[A-Za-z0-9_=&-]*)?)?$/,
      "Lien de groupe WhatsApp invalide (https://chat.whatsapp.com/...).",
    )
    .transform((value) => value || null),
  // Blanks dropped: a filled link is shown, whichever field it was typed in.
  exampleVideoUrls: z
    .array(
      z
        .string()
        .trim()
        .refine(
          (value) => !value || getVideoEmbedUrl("YOUTUBE", value),
          "Lien YouTube invalide.",
        ),
    )
    .max(3)
    .transform((urls) => urls.filter(Boolean)),
  registrationsOpen: z.boolean(),
});

export const adminWorkshopRegistrationSchema = z.object({
  fullName: workshopRegistrationSchema.shape.fullName,
  whatsapp: phoneField,
  email: workshopRegistrationSchema.shape.email,
  city: workshopRegistrationSchema.shape.city,
  amount: z.coerce.number().int().min(0).max(1_000_000),
});
