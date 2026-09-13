import { z } from "zod";
import { usernameSchema } from "./auth";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(120),
  username: usernameSchema,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
