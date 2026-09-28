"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { requireAdmin } from "@/services/auth/current-user";
import {
  approveWithdrawal,
  PayoutAttemptFailedError,
} from "@/services/admin/approve-withdrawal";
import { rejectWithdrawal } from "@/services/admin/reject-withdrawal";
import { syncPaydunyaPayout } from "@/services/payments/sync-paydunya-payout";

export async function approveWithdrawalAction(requestId: string) {
  const { profile } = await requireAdmin();
  try {
    await approveWithdrawal(profile.id, requestId);
    revalidatePath("/admin/withdrawals");
    return { error: null };
  } catch (err) {
    // A failed payout attempt already saved its reason on the request —
    // refreshing the page shows it there, once, instead of twice.
    if (err instanceof PayoutAttemptFailedError) {
      revalidatePath("/admin/withdrawals");
      return { error: null };
    }
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

// "Vérifier le statut" on a payout still in progress — asks PayDunya for the
// real outcome and applies it (sync-paydunya-payout.ts). The safe way out
// of an uncertain attempt: never re-sends anything.
export async function checkWithdrawalPayoutAction(requestId: string) {
  await requireAdmin();
  const request = await db.query.withdrawalRequests.findFirst({
    where: eq(withdrawalRequests.id, requestId),
  });
  if (!request || request.status !== "PROCESSING") {
    return { message: "Ce virement n'est plus en cours." };
  }
  if (!request.payoutProviderReference) {
    return {
      message:
        "Aucune référence PayDunya pour ce virement : vérifiez directement votre tableau de bord PayDunya.",
    };
  }
  try {
    const status = await syncPaydunyaPayout(request.payoutProviderReference);
    revalidatePath("/admin/withdrawals");
    return {
      message:
        status === "success"
          ? "Virement confirmé : la demande est marquée comme payée."
          : status === "pending"
            ? "Virement toujours en cours chez l'opérateur. Réessayez plus tard."
            : status === "unknown-request"
              ? "Référence inconnue."
              : "Le virement n'a pas abouti : la demande est de nouveau en attente de validation.",
    };
  } catch (err) {
    return {
      message: err instanceof Error ? err.message : "Vérification impossible.",
    };
  }
}

export async function rejectWithdrawalAction(
  requestId: string,
  reason: string,
) {
  const { profile } = await requireAdmin();
  try {
    await rejectWithdrawal(profile.id, requestId, reason);
    revalidatePath("/admin/withdrawals");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
