"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import {
  AMBASSADOR_TERMS_VERSION,
  joinAmbassadorProgramInNewTransaction,
} from "@/services/ambassador/join-program";

export async function joinAmbassadorProgramAction(sponsorUsername: string) {
  const { profile } = await requireUser();
  try {
    await joinAmbassadorProgramInNewTransaction(profile.id, {
      sponsorUsername: sponsorUsername || undefined,
      termsVersion: AMBASSADOR_TERMS_VERSION,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  // The sidebar's ambassador-only items and the "Devenir ambassadeur" link
  // (dashboard/layout.tsx) come from a DB lookup cached per the shared
  // /dashboard layout — without invalidating it, a browser that already had
  // the dashboard open keeps showing the pre-join sidebar after the
  // redirect below, even though the join itself fully succeeded.
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
