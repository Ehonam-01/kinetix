"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/auth/current-user";
import { createDirectSaleCommissionRule } from "@/services/admin/create-direct-sale-rule";
import { createGenerationCommissionRule } from "@/services/admin/create-generation-rule";

export async function createDirectSaleRuleAction(input: {
  courseId?: string;
  category?: string;
  commissionType: "FIXED" | "PERCENTAGE" | "BV_PERCENTAGE";
  rate: number;
  cap?: number;
}) {
  const { profile } = await requireAdmin();
  try {
    await createDirectSaleCommissionRule(profile.id, input);
    revalidatePath("/admin/commission-rules");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}

export async function createGenerationRuleAction(input: {
  levelCode: number;
  generation: number;
  commissionType: "FIXED" | "PERCENTAGE" | "BV_PERCENTAGE";
  rate: number;
  cap?: number;
  requirePresence: boolean;
  minimumBv?: number;
}) {
  const { profile } = await requireAdmin();
  try {
    await createGenerationCommissionRule(profile.id, input);
    revalidatePath("/admin/commission-rules");
    return { error: null };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
    };
  }
}
