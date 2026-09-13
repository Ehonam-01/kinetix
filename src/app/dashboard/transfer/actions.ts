"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { confirmTransfer } from "@/services/wallet/confirm-transfer";
import { initiateTransfer } from "@/services/wallet/initiate-transfer";

// {error}-return convention (like login/register actions), not a bare
// throw (like claim-reward-form.tsx): wrong OTP codes and insufficient
// balance are expected, frequent outcomes of this specific 2-step flow,
// not exceptional bugs — the form needs to show them inline and let the
// member retry, not fall through to a generic error boundary.
export async function initiateTransferAction(
  recipientUsername: string,
  amount: number,
) {
  const { profile } = await requireUser();
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
  const { profile } = await requireUser();
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
