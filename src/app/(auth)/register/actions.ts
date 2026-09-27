"use server";

import { isIpRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { registerSchema } from "@/schemas/auth";
import { lookupSponsorByUsername, registerUser } from "@/services/auth/register";

export async function registerAction(input: unknown) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  if (await isIpRateLimited("signupByIp")) return { error: RATE_LIMIT_MESSAGE };
  return registerUser(parsed.data);
}

// Reachable without a session — capped per IP so the pseudo -> full name
// preview can't be used to enumerate the member base.
export async function lookupSponsorAction(username: string) {
  if (await isIpRateLimited("lookup")) return { fullName: null };
  const sponsor = await lookupSponsorByUsername(username);
  return { fullName: sponsor?.fullName ?? null };
}
