"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/services/auth/current-user";
import {
  AMBASSADOR_TERMS_VERSION,
  joinAmbassadorProgram,
} from "@/services/ambassador/join-program";

export async function joinAmbassadorProgramAction(sponsorUsername: string) {
  const { profile } = await requireUser();
  try {
    await joinAmbassadorProgram(profile.id, {
      sponsorUsername: sponsorUsername || undefined,
      termsVersion: AMBASSADOR_TERMS_VERSION,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  redirect("/dashboard");
}
