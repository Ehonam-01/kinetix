"use server";

import { revalidatePath } from "next/cache";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { usernameSchema } from "@/schemas/auth";
import { findActiveProfileByUsername } from "@/repositories/profiles";
import { requireActiveMember } from "@/services/auth/current-user";
import { confirmTransfer } from "@/services/wallet/confirm-transfer";
import { initiateTransfer } from "@/services/wallet/initiate-transfer";

// Live "who am I about to send money to?" preview (transfer-form.tsx) —
// pseudo -> display name only, same narrow shape and reasoning as
// register's lookupSponsorAction. Still gated behind requireUser (unlike
// the registration one): this page is only reachable by an authenticated
// member in the first place.
export async function lookupRecipientAction(username: string) {
  const { profile } = await requireActiveMember();
  if (await isRateLimited("lookup", `user:${profile.id}`)) {
    return { fullName: null };
  }
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) return { fullName: null };

  const recipient = await findActiveProfileByUsername(parsed.data);
  return { fullName: recipient?.fullName ?? null };
}

// {error}-return convention (like login/register actions), not a bare
// throw (like claim-reward-form.tsx): wrong OTP codes and insufficient
// balance are expected, frequent outcomes of this specific 2-step flow,
// not exceptional bugs — the form needs to show them inline and let the
// member retry, not fall through to a generic error boundary.
export async function initiateTransferAction(
  recipientUsername: string,
  amount: number,
) {
  const { profile } = await requireActiveMember();
  if (await isRateLimited("otpRequest", `user:${profile.id}`)) {
    return { transferId: null, error: RATE_LIMIT_MESSAGE };
  }
  try {
    const transfer = await initiateTransfer(
      profile.id,
      recipientUsername,
      amount,
    );
    return { transferId: transfer.id as string, error: null };
  } catch (err) {
    return {
      transferId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function confirmTransferAction(transferId: string, code: string) {
  const { profile } = await requireActiveMember();
  if (await isRateLimited("otpConfirm", `user:${profile.id}`)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  try {
    await confirmTransfer(profile.id, transferId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/dashboard/transfer");
  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard");
  return { error: null };
}
