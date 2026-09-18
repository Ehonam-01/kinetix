"use server";

import { registerSchema } from "@/schemas/auth";
import { lookupSponsorByUsername, registerUser } from "@/services/auth/register";

export async function registerAction(input: unknown) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  return registerUser(parsed.data);
}

export async function lookupSponsorAction(username: string) {
  const sponsor = await lookupSponsorByUsername(username);
  return { fullName: sponsor?.fullName ?? null };
}
