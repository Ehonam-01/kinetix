// Provider-agnostic contract (section 22): the rest of the app depends on
// this interface only, never on a specific vendor. See moneroo.ts for the
// current concrete implementation.

export type PaymentCustomer = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type CreatePaymentInput = {
  amount: number;
  description: string;
  customer: PaymentCustomer;
  returnUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
  // Bictorys' "direct softpay" mode: pushes an SMS/USSD prompt straight to
  // customer.phone via this operator instead of returning a hosted
  // checkout page to redirect to (see bictorys.ts's createPayment).
  // Moneroo has no equivalent — its own API is redirect-only — and simply
  // ignores this field.
  operator?: string;
};

export type PaymentIntent = {
  providerReference: string;
  // null when the provider pushed the charge directly to the customer's
  // phone instead of returning a page to send them to — the caller must
  // not redirect in that case.
  checkoutUrl: string | null;
  // Shown to the member when checkoutUrl is null, e.g. Bictorys' own "you
  // will receive a sms with instructions to accept payment."
  confirmationMessage?: string;
};

export type PaymentStatus = "PENDING" | "CONFIRMED" | "FAILED";

export type VerifiedPayment = {
  providerReference: string;
  status: PaymentStatus;
  amount: number;
};

export type WebhookEvent = {
  providerReference: string;
  status: PaymentStatus;
  eventType: string;
  // Derived by the adapter, not necessarily a field the provider sends —
  // see moneroo.ts, which has no official unique event id to rely on.
  dedupeKey: string;
  raw: unknown;
};

export type RefundResult = {
  refundReference: string;
};

export type PaymentProviderName = "MONEROO" | "BICTORYS";

export interface PaymentProvider {
  // Written verbatim to payments.provider (a plain text column) — lets
  // call sites (initiate-registration-payment.ts, initiate-subscription-
  // payment.ts) record which provider actually handled a charge without
  // hardcoding a literal per call site, now that provider-selector.ts picks
  // between more than one.
  name: PaymentProviderName;
  createPayment(input: CreatePaymentInput): Promise<PaymentIntent>;
  verifyPayment(providerReference: string): Promise<VerifiedPayment>;
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent;
  // Not every provider supports this — Moneroo's current adapter throws
  // (no refund endpoint in their documentation as of this writing).
  refundPayment(
    providerReference: string,
    amount?: number,
  ): Promise<RefundResult>;
}
