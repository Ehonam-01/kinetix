"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { refundSale } from "@/services/sales/refund-sale";

export async function refundSaleAction(
  saleId: string,
  input: { reason?: string; revokeAccess: boolean },
) {
  const { profile } = await requireAdmin();
  try {
    await refundSale(profile.id, saleId, input);
    revalidatePath("/admin/sales");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
