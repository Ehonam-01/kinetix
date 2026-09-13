"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/auth/current-user";
import { confirmWithdrawal } from "@/services/wallet/confirm-withdrawal";
import { requestWithdrawal } from "@/services/wallet/request-withdrawal";

// Same {error}-return convention as dashboard/transfer/actions.ts: a wrong
// amount/phone/OTP code is an expected, frequent outcome of this 2-step
// flow, not an exceptional bug — the form shows it inline and lets the
// member retry.
export async function requestWithdrawalAction(
  amount: number,
  payoutPhone: string,
) {
  const { profile } = await requireUser();
  try {
    const request = await requestWithdrawal(profile.id, amount, payoutPhone);
    return { requestId: request.id as string, error: null };
  } catch (err) {
    return {
      requestId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function confirmWithdrawalAction(requestId: string, code: string) {
  const { profile } = await requireUser();
  try {
    await confirmWithdrawal(profile.id, requestId, code);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
  revalidatePath("/dashboard/withdrawals");
  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard");
  return { error: null };
}
