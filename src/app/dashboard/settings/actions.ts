"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/schemas/auth";
import { updateCommunityProfileSchema } from "@/schemas/community-profile";
import { updateProfileSchema } from "@/schemas/profile";
import { confirmAccountDeletion } from "@/services/account/confirm-account-deletion";
import { requestAccountDeletion } from "@/services/account/request-account-deletion";
import { requireActiveMember, requireUser } from "@/services/auth/current-user";
import { logoutUser } from "@/services/auth/logout";
import { changePassword } from "@/services/auth/change-password";
import { updateCommunityProfile } from "@/services/profile/update-community-profile";
import { updateProfile } from "@/services/profile/update-profile";

export async function updateProfileAction(input: unknown) {
  const { profile } = await requireActiveMember();

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const result = await updateProfile(profile.id, parsed.data);
  if (result.error) return { error: result.error };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function updateCommunityProfileAction(input: unknown) {
  const { profile } = await requireActiveMember();

  const parsed = updateCommunityProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  await updateCommunityProfile(profile.id, parsed.data);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/community");
  return { error: null };
}

// Requires the current password (services/auth/change-password.ts) — an
// active session alone isn't enough to permanently take over an account
// that holds a real wallet balance (security audit M6).
export async function changePasswordAction(input: unknown) {
  const { profile } = await requireUser();
  // The current-password check would otherwise be an unlimited oracle for
  // guessing it from a hijacked session.
  if (await isRateLimited("passwordChange", `user:${profile.id}`)) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  return changePassword(parsed.data);
}

export async function requestAccountDeletionAction() {
  const { profile } = await requireUser();
  if (await isRateLimited("otpRequest", `user:${profile.id}`)) {
    return { requestId: null, error: RATE_LIMIT_MESSAGE };
  }
  try {
    const request = await requestAccountDeletion(profile.id, profile.id);
    return { requestId: request.id as string, error: null };
  } catch (err) {
    return {
      requestId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

// Signs out and redirects on success, unlike every other action here: once
// confirmed, this member's own session has no reason to keep existing —
// the profile is anonymized and the login is being locked out server-side
// (services/account/lock-auth-account.ts) in the same breath.
export async function confirmAccountDeletionAction(
  requestId: string,
  code: string,
) {
  const { profile } = await requireUser();
  if (await isRateLimited("otpConfirm", `user:${profile.id}`)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  try {
    await confirmAccountDeletion(profile.id, requestId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  await logoutUser();
  redirect("/login");
}
