"use server";

import { cookies } from "next/headers";
import { GOAL_COOKIE_NAME, isGoalValue } from "@/config/goals";
import { isIpRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { registerSchema } from "@/schemas/auth";
import {
  lookupSponsorByUsername,
  registerUser,
} from "@/services/auth/register";
import {
  MARKETING_COOKIE_NAME,
  parseMarketingCookie,
} from "@/services/marketing/campaign-tracking";

export async function registerAction(input: unknown) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  if (await isIpRateLimited("signupByIp")) return { error: RATE_LIMIT_MESSAGE };

  // A goal picked on the homepage before signing up (app/orientation):
  // stored on the new profile, so the dashboard can follow up on it.
  const cookieStore = await cookies();
  const rawGoal = cookieStore.get(GOAL_COOKIE_NAME)?.value;
  const goal = isGoalValue(rawGoal) ? rawGoal : null;

  // The campaign this visitor came from, if any (Admin → Marketing).
  const marketingVisitId =
    parseMarketingCookie(cookieStore.get(MARKETING_COOKIE_NAME)?.value)
      ?.firstVisitId ?? null;

  const result = await registerUser(parsed.data, { goal, marketingVisitId });
  if (!result.error && goal) cookieStore.delete(GOAL_COOKIE_NAME);
  return result;
}

// Reachable without a session — capped per IP so the pseudo -> full name
// preview can't be used to enumerate the member base.
export async function lookupSponsorAction(username: string) {
  if (await isIpRateLimited("lookup")) return { fullName: null };
  const sponsor = await lookupSponsorByUsername(username);
  return { fullName: sponsor?.fullName ?? null };
}
