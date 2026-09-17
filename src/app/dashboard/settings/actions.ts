"use server";

import { revalidatePath } from "next/cache";
import { resetPasswordSchema } from "@/schemas/auth";
import { updateCommunityProfileSchema } from "@/schemas/community-profile";
import { updateProfileSchema } from "@/schemas/profile";
import { requireUser } from "@/services/auth/current-user";
import { updatePassword } from "@/services/auth/update-password";
import { updateCommunityProfile } from "@/services/profile/update-community-profile";
import { updateProfile } from "@/services/profile/update-profile";

export async function updateProfileAction(input: unknown) {
  const { profile } = await requireUser();

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
  const { profile } = await requireUser();

  const parsed = updateCommunityProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  await updateCommunityProfile(profile.id, parsed.data);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/community");
  return { error: null };
}

// No current-password check: the member is already authenticated by an
// active session, same trust level as the recovery-link flow this reuses
// updatePassword from (services/auth/update-password.ts) — that flow also
// asks for nothing but the new password.
export async function changePasswordAction(input: unknown) {
  await requireUser();

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const { error } = await updatePassword(parsed.data);
  return { error };
}
