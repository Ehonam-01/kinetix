"use server";

import { revalidatePath } from "next/cache";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { requireActiveMember } from "@/services/auth/current-user";
import { confirmWithdrawal } from "@/services/wallet/confirm-withdrawal";
import { requestWithdrawal } from "@/services/wallet/request-withdrawal";

// Same {error}-return convention as dashboard/transfer/actions.ts: a wrong
// amount/phone/OTP code is an expected, frequent outcome of this 2-step
// flow, not an exceptional bug — the form shows it inline and lets the
// member retry.
export async function requestWithdrawalAction(
  amount: number,
  payoutPhone: string,
  operator: string,
  country: string,
) {
  const { profile } = await requireActiveMember();
  if (await isRateLimited("otpRequest", `user:${profile.id}`)) {
    return { requestId: null, error: RATE_LIMIT_MESSAGE };
  }
  try {
    const request = await requestWithdrawal(
      profile.id,
      amount,
      payoutPhone,
      operator,
      country,
    );
    return { requestId: request.id as string, error: null };
  } catch (err) {
    return {
      requestId: null,
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function confirmWithdrawalAction(requestId: string, code: string) {
  const { profile } = await requireActiveMember();
  if (await isRateLimited("otpConfirm", `user:${profile.id}`)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
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
