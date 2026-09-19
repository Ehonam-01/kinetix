import "server-only";
import type { Executor } from "@/db/executor";
import { getActiveProviderKey } from "@/repositories/payment-settings";
import { bictorysProvider } from "./bictorys";
import { monerooProvider } from "./moneroo";
import { paydunyaProvider } from "./paydunya";
import type { PaymentProvider } from "./provider";

// The one indirection point between "which inbound-payment provider is
// active" (admin-configurable, /admin/payments) and the two call sites
// that actually charge a customer (initiate-registration-payment.ts,
// initiate-subscription-payment.ts). None of them imports monerooProvider,
// bictorysProvider or paydunyaProvider directly anymore.
export async function getActivePaymentProvider(
  executor: Executor,
): Promise<PaymentProvider> {
  const key = await getActiveProviderKey(executor);
  if (key === "BICTORYS") return bictorysProvider;
  if (key === "PAYDUNYA") return paydunyaProvider;
  return monerooProvider;
}

// Unlike getActivePaymentProvider, resolves whichever provider actually
// handled a given payment (payments.provider), not whichever is currently
// active — needed by services/admin/reconcile-payment.ts and the
// subscription polling action, since an old payment must always be
// checked against the provider that took it, no matter what an admin has
// since switched the active one to.
export function getPaymentProviderByName(name: string): PaymentProvider {
  if (name === "BICTORYS") return bictorysProvider;
  if (name === "MONEROO") return monerooProvider;
  if (name === "PAYDUNYA") return paydunyaProvider;
  throw new Error(`Fournisseur de paiement inconnu : ${name}`);
}
