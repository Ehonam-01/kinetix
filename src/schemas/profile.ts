import { z } from "zod";
import { usernameSchema } from "./auth";
import { toWhatsappDigits, WHATSAPP_FORMAT_ERROR } from "@/lib/whatsapp";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(120),
  username: usernameSchema,
  // The WhatsApp number, normalized to international digits; empty clears
  // it.
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value, ctx) => {
      if (!value) return "";
      const digits = toWhatsappDigits(value);
      if (!digits) {
        ctx.addIssue({ code: "custom", message: WHATSAPP_FORMAT_ERROR });
        return z.NEVER;
      }
      return digits;
    }),
  country: z.string().trim().max(60).optional().or(z.literal("")),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
