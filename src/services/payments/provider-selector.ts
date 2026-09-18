import "server-only";
import type { Executor } from "@/db/executor";
import { getActiveProviderKey } from "@/repositories/payment-settings";
import { bictorysProvider } from "./bictorys";
import { monerooProvider } from "./moneroo";
import type { PaymentProvider } from "./provider";

// The one indirection point between "which inbound-payment provider is
// active" (admin-configurable, /admin/payments) and the two call sites
// that actually charge a customer (initiate-registration-payment.ts,
// initiate-subscription-payment.ts). Neither of them imports monerooProvider
// or bictorysProvider directly anymore.
export async function getActivePaymentProvider(
  executor: Executor,
): Promise<PaymentProvider> {
  const key = await getActiveProviderKey(executor);
  return key === "BICTORYS" ? bictorysProvider : monerooProvider;
}
