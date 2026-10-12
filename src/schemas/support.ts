import { z } from "zod";
import { SUPPORT_CATEGORIES } from "@/config/support";

const CATEGORY_VALUES = SUPPORT_CATEGORIES.map((c) => c.value) as [
  string,
  ...string[],
];

const messageBody = z
  .string()
  .trim()
  .min(10, "Ton message est trop court : décris ta demande en quelques mots.")
  .max(3000, "3 000 caractères maximum");

export const newTicketSchema = z.object({
  category: z.enum(CATEGORY_VALUES, { message: "Choisis un sujet." }),
  subject: z
    .string()
    .trim()
    .min(5, "Donne un titre à ta demande.")
    .max(120, "120 caractères maximum"),
  message: messageBody,
});
export type NewTicketInput = z.infer<typeof newTicketSchema>;

export const ticketMessageSchema = z.object({ body: messageBody });
