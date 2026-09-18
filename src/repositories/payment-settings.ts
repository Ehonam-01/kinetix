import "server-only";
import { eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { paymentSettings, type paymentProviderEnum } from "@/db/schema/payment-settings";

const SETTINGS_ID = "default";

export type PaymentProviderKey = (typeof paymentProviderEnum.enumValues)[number];

// Seeded by migration 0043 — always exists, so callers never special-case
// "no row yet".
export async function getActiveProviderKey(
  executor: Executor,
): Promise<PaymentProviderKey> {
  const row = await executor.query.paymentSettings.findFirst({
    where: eq(paymentSettings.id, SETTINGS_ID),
  });
  return row?.activeProvider ?? "MONEROO";
}

export const PAYMENT_SETTINGS_ID = SETTINGS_ID;
