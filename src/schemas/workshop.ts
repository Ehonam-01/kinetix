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

const cityField = z
  .string()
  .trim()
  .min(2, "Indique ta ville.")
  .max(80, "Ce nom de ville est trop long.");

// The smallest part a participant may pay at once (explicit user
// decision), unless what is left is less.
export const MIN_WORKSHOP_INSTALLMENT = 1000;

const installmentField = z.coerce
  .number({ error: "Indique le montant à payer." })
  .int("Indique un montant en francs, sans virgule.")
  .min(
    MIN_WORKSHOP_INSTALLMENT,
    `Le montant minimum est de ${MIN_WORKSHOP_INSTALLMENT.toLocaleString("fr-FR")} F.`,
  );

const operatorField = z.enum(["TOGOCELL", "MOOV_MONEY"], {
  error: "Choisis ton opérateur Mobile Money.",
});

export const workshopRegistrationSchema = z.object({
  // The city: one of the page's sessions (the service checks which).
  sessionId: z.uuid("Choisis ta ville."),
  fullName: z
    .string()
    .trim()
    .min(2, "Indique ton nom complet.")
    .max(120, "Ce nom est trop long."),
  whatsapp: phoneField,
  email: z
    .union([z.literal(""), z.email("Adresse e-mail invalide.")])
    .transform((value) => value || null),
  operator: operatorField,
  // Blank: the WhatsApp number pays.
  paymentPhone: z.union([z.literal(""), phoneField]),
  // The first payment: the whole price, or a part of it. Its upper bound,
  // the price, is checked by the service, which knows it.
  amount: installmentField,
});

export type WorkshopRegistrationInput = z.input<
  typeof workshopRegistrationSchema
>;

// Another part, from the confirmation page: the token is the participant's
// proof of identity there.
export const workshopInstallmentSchema = z.object({
  token: z.string().min(1).max(200),
  operator: operatorField,
  paymentPhone: phoneField,
  // The service also accepts less than the minimum when that is all that
  // is left; this only rules out nonsense.
  amount: z.coerce
    .number({ error: "Indique le montant à payer." })
    .int("Indique un montant en francs, sans virgule.")
    .min(1, "Indique le montant à payer."),
});

export type WorkshopInstallmentInput = z.input<
  typeof workshopInstallmentSchema
>;

const whatsappGroupField = z
  .string()
  .trim()
  .regex(
    /^(https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+\/?(\?[A-Za-z0-9_=&-]*)?)?$/,
    "Lien de groupe WhatsApp invalide (https://chat.whatsapp.com/...).",
  )
  .transform((value) => value || null);

// The sales page's own settings: its videos.
export const workshopPageSchema = z.object({
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
  // The slider: as many as the admin wants, within reason (each one
  // visible plays on its own).
  sliderVideoUrls: z
    .array(
      z
        .string()
        .trim()
        .refine(
          (value) => !value || getVideoEmbedUrl("YOUTUBE", value),
          "Lien YouTube invalide dans le slider.",
        ),
    )
    .transform((urls) => urls.filter(Boolean))
    .pipe(z.array(z.string()).max(12, "12 vidéos au plus dans le slider.")),
  heroVideoUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || getVideoEmbedUrl("YOUTUBE", value),
      "Lien YouTube invalide.",
    )
    .transform((value) => value || null),
});

const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Indique la date de la session.");
const timeField = z.string().regex(/^\d{2}:\d{2}$/, "Indique l'heure.");

// One city's session. Its date and hours are typed in Lomé time, which is
// UTC.
export const workshopSessionSchema = z
  .object({
    city: cityField,
    day: dayField,
    startTime: timeField,
    endTime: timeField,
    priceCfa: z.coerce.number().int().min(100).max(1_000_000),
    regularPriceCfa: z.coerce.number().int().min(0).max(10_000_000),
    capacity: z.coerce.number().int().min(0).max(100_000),
    // Blank: the page shows the city until the address is set.
    venue: z.string().trim().max(300),
    whatsappGroupUrl: whatsappGroupField,
    registrationsOpen: z.boolean(),
  })
  .transform(({ day, startTime, endTime, ...values }, ctx) => {
    const startsAt = new Date(`${day}T${startTime}:00Z`);
    const endsAt = new Date(`${day}T${endTime}:00Z`);
    if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) {
      ctx.addIssue({
        code: "custom",
        message: "L'heure de fin doit suivre l'heure de début.",
      });
      return z.NEVER;
    }
    // The participant's code stays usable until the end of the next day.
    const discountValidUntil = new Date(`${day}T23:59:59Z`);
    discountValidUntil.setUTCDate(discountValidUntil.getUTCDate() + 1);
    return { ...values, startsAt, endsAt, discountValidUntil };
  });

export const adminWorkshopRegistrationSchema = z.object({
  // The session (city) they come to; the city is taken from it.
  workshopId: z.uuid("Choisis la session."),
  fullName: workshopRegistrationSchema.shape.fullName,
  whatsapp: phoneField,
  email: workshopRegistrationSchema.shape.email,
  amount: z.coerce.number().int().min(0).max(1_000_000),
});
