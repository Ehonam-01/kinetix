import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getBictorysEnv } from "@/config/env.bictorys";
import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  RefundResult,
  VerifiedPayment,
  WebhookEvent,
} from "./provider";

// https://docs.bictorys.com/docs/comprendre-lapi-de-paiement,
// /reference/createcharge, /reference/gettransactiondetails,
// /reference/refundtransaction, /docs/how-to-validate-webhooks
const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.bictorys.com"
    : "https://api.test.bictorys.com";

// Kinetix Africa's members are in Togo (the withdrawal form's phone
// placeholder is "+228..."). Bictorys' charge/transaction endpoints accept
// a "country" field; there's no per-member country capture reliable enough
// to derive this from today (profiles.country is free-text, not an ISO
// code) — revisit if the platform ever expands beyond Togo.
const COUNTRY = "TG";

type BictorysCheckoutLinkResponse = {
  type: "CheckoutLinkObject";
  chargeId: string;
  link: string;
};

type BictorysMobilePaymentResponse = {
  type: "MobilePaymentObject";
  transactionId: string;
  link: string;
};

type BictorysChargeResponse =
  | BictorysCheckoutLinkResponse
  | BictorysMobilePaymentResponse;

type BictorysTransactionResponse = {
  id: string;
  status:
    | "succeeded"
    | "failed"
    | "cancelled"
    | "pending"
    | "processing"
    | "reversed"
    | "authorized";
  amount: number;
  currency: string;
};

// No documented "event type" field on the webhook payload (unlike
// Moneroo's "event": "payment.success") — only a point-in-time snapshot of
// the transaction, so status doubles as the closest thing to one (see
// dedupeKey below).
const bictorysWebhookSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
  paymentReference: z.string().optional(),
});

// Shared by both webhook kinds Bictorys sends to this merchant account —
// charge/payment confirmations (parseWebhook below) and payout/transfer
// confirmations (services/payments/handle-payout-webhook.ts) — since both
// carry the same X-Secret-Key header and the same merchant-level secret.
export function verifyBictorysWebhookSecret(signature: string | null): void {
  if (!signature) {
    throw new Error("Webhook Bictorys reçu sans en-tête X-Secret-Key.");
  }
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(getBictorysEnv().BICTORYS_WEBHOOK_SECRET);
  const validSignature =
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!validSignature) {
    throw new Error("Secret de webhook Bictorys invalide.");
  }
}

function toPaymentStatus(bictorysStatus: string): PaymentStatus {
  switch (bictorysStatus) {
    case "succeeded":
      return "CONFIRMED";
    case "failed":
    case "cancelled":
    case "reversed":
      return "FAILED";
    default:
      return "PENDING";
  }
}

async function bictorysRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": getBictorysEnv().BICTORYS_SECRET_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bictorys ${path} a répondu ${response.status} : ${body}`);
  }

  if (response.status === 202 && !response.headers.get("content-length")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const bictorysProvider: PaymentProvider = {
  name: "BICTORYS",

  // No payment_type query param: Bictorys then hosts its own checkout page
  // (operator/card picker included) and redirects back to returnUrl — same
  // hosted-checkout shape as monerooProvider.createPayment, so the rest of
  // the app (initiate-registration-payment.ts, initiate-subscription-
  // payment.ts) doesn't need to know which provider is active.
  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const fullName = `${input.customer.firstName} ${input.customer.lastName}`.trim();

    const result = await bictorysRequest<BictorysChargeResponse>(
      "/pay/v1/charges",
      {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount,
          currency: "XOF",
          country: COUNTRY,
          // A bare UUID, not input.idempotencyKey verbatim — Bictorys
          // rejects that compound "SUBSCRIPTION:<uuid>:<uuid>" shape with
          // "E400-46: Invalid merchantReference format" (caught live in
          // production; their docs don't document the constraint, but their
          // own example value is a plain UUID). This field is purely
          // informational on our side regardless — dedupe/lookup already
          // goes through payments.idempotency_key and the chargeId/
          // transactionId Bictorys itself returns as providerReference,
          // never through merchantReference.
          merchantReference: randomUUID(),
          successRedirectUrl: input.returnUrl,
          errorRedirectUrl: input.returnUrl,
          customerObject: {
            name: fullName,
            email: input.customer.email,
            phone: input.customer.phone,
          },
        }),
      },
    );

    return result.type === "MobilePaymentObject"
      ? { providerReference: result.transactionId, checkoutUrl: result.link }
      : { providerReference: result.chargeId, checkoutUrl: result.link };
  },

  // Assumes the charge/checkout id returned by createPayment (chargeId) can
  // be looked up as a transactionId here — Bictorys' docs don't spell out
  // whether the two ids are actually the same value once a customer
  // completes checkout. Unverified against a real payment as of writing;
  // if this 404s in practice, check whether the webhook payload's own `id`
  // needs to replace providerReference in the payments row instead.
  async verifyPayment(providerReference: string): Promise<VerifiedPayment> {
    const result = await bictorysRequest<BictorysTransactionResponse>(
      `/pay/v1/transactions/${providerReference}`,
      { method: "GET" },
    );

    return {
      providerReference: result.id,
      status: toPaymentStatus(result.status),
      amount: result.amount,
    };
  },

  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    // Bictorys sends the raw configured secret as a header value (not an
    // HMAC signature over the body, unlike Moneroo).
    verifyBictorysWebhookSecret(signature);

    const payload = bictorysWebhookSchema.parse(JSON.parse(rawBody));

    return {
      providerReference: payload.id,
      status: toPaymentStatus(payload.status),
      eventType: payload.status,
      // Status doubles as the event type (see schema comment above) —
      // distinct statuses for the same transaction id produce distinct
      // keys (a real pending -> succeeded transition is processed), while
      // a redelivery of the same status is deduped.
      dedupeKey: `${payload.id}:${payload.status}`,
      raw: payload,
    };
  },

  async refundPayment(providerReference: string): Promise<RefundResult> {
    await bictorysRequest(`/pay/v1/transactions/${providerReference}/refund`, {
      method: "PUT",
    });
    return { refundReference: providerReference };
  },
};
