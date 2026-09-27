"use server";

import { redirect } from "next/navigation";
import {
  isIpRateLimited,
  isRateLimited,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";
import { loginSchema } from "@/schemas/auth";
import { loginUser } from "@/services/auth/login";

export async function loginAction(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  // Both counters are checked (and consumed) on every attempt: per IP
  // against credential stuffing across many accounts, per email against
  // brute force on one account from many IPs.
  const [ipLimited, emailLimited] = await Promise.all([
    isIpRateLimited("loginByIp"),
    isRateLimited("loginByEmail", `email:${parsed.data.email.toLowerCase()}`),
  ]);
  if (ipLimited || emailLimited) return { error: RATE_LIMIT_MESSAGE };

  const { error } = await loginUser(parsed.data);
  if (error) return { error };

  redirect("/dashboard");
}
