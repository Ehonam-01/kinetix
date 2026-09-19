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

// Unlike getActivePaymentProvider, resolves whichever provider actually
// handled a given payment (payments.provider), not whichever is currently
// active — needed by services/admin/reconcile-payment.ts, since an old
// payment must always be checked against the provider that took it, no
// matter what an admin has since switched the active one to.
export function getPaymentProviderByName(name: string): PaymentProvider {
  if (name === "BICTORYS") return bictorysProvider;
  if (name === "MONEROO") return monerooProvider;
  throw new Error(`Fournisseur de paiement inconnu : ${name}`);
}
