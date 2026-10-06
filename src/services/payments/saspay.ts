import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getSaspaySecretKey,
  getSaspayWebhookSecret,
} from "@/config/env.saspay";
import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  RefundResult,
  VerifiedPayment,
  WebhookEvent,
} from "./provider";

// https://docs.saspay.me — used for the countries PayDunya doesn't cover
// (and bank cards), through SasPay's hosted checkout: the member is sent
// to a SasPay page where they pick their own country and network (or pay
// by card), so no per-country phone format or OTP rule lives here.
//
// Not an "active provider" (admin/payments' toggle): it runs alongside
// PayDunya, chosen by the member with "Mon pays n'est pas dans la liste"
// on the payment form (services/subscriptions/initiate-subscription-
// payment.ts).
const BASE_URL = "https://api.saspay.me/api/v1";

// How long a webhook timestamp may differ from our clock (SasPay's own
// recommendation) — beyond it a captured webhook could be replayed.
const WEBHOOK_TOLERANCE_SECONDS = 300;

type CheckoutSession = {
  id: string;
  checkout_url: string;
  amount: string;
  currency: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
};

type CheckoutStatus = {
  id: string;
  status: CheckoutSession["status"];
  transaction_status?: string | null;
};

// SasPay documents an envelope ({success, data, code}) but its examples
// show bare objects: accept both.
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body && "success" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

async function saspayRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSaspaySecretKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    // Logged, never shown to the member (security audit M8, same as the
    // other providers).
    console.error(
      `SasPay ${path} a répondu ${response.status} :`,
      await response.text(),
    );
    throw new Error(
      "Le service de paiement a refusé la requête. Veuillez réessayer.",
    );
  }
  return unwrap<T>(await response.json());
}

// A checkout session is paid once, and only its own status says so: PAID
// is the money taken; EXPIRED/CANCELLED will never be paid. While PENDING
// the member can still retry a failed attempt on SasPay's page, so a
// failed transaction alone doesn't fail the session.
export function toPaymentStatus(status: string): PaymentStatus {
  if (status === "PAID") return "CONFIRMED";
  if (status === "EXPIRED" || status === "CANCELLED") return "FAILED";
  return "PENDING";
}

// "19500.00" → 19500: the session amount is the one we created it with,
// in F CFA, whatever currency the member actually paid in.
function parseAmount(amount: string): number {
  return Math.round(Number(amount));
}

// The headers SasPay signs every webhook with: HMAC-SHA256 (hex) of
// "<timestamp>.<raw body>", and the timestamp itself (Unix seconds).
export function verifySaspayWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret = getSaspayWebhookSecret(),
  now = Math.floor(Date.now() / 1000),
): void {
  if (!signature || !timestamp) {
    throw new Error("Webhook SasPay sans signature ou horodatage.");
  }
  const sentAt = Number(timestamp);
  if (
    !Number.isFinite(sentAt) ||
    Math.abs(now - sentAt) > WEBHOOK_TOLERANCE_SECONDS
  ) {
    throw new Error("Webhook SasPay hors délai.");
  }
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(signature.toLowerCase());
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Signature de webhook SasPay invalide.");
  }
}

export const saspayProvider: PaymentProvider = {
  name: "SASPAY",

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const session = await saspayRequest<CheckoutSession>(
      "/checkout-sessions/",
      {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount.toFixed(2),
          currency: "XOF",
          description: input.description,
          customer_email: input.customer.email,
          customer_name:
            `${input.customer.firstName} ${input.customer.lastName}`.trim(),
          return_url: input.returnUrl,
          metadata: {
            idempotency_key: input.idempotencyKey,
            ...input.metadata,
          },
        }),
      },
    );
    return { providerReference: session.id, checkoutUrl: session.checkout_url };
  },

  // The status endpoint re-checks the gateway itself before answering;
  // the amount comes from the session, i.e. what we asked for.
  async verifyPayment(providerReference: string): Promise<VerifiedPayment> {
    const id = encodeURIComponent(providerReference);
    const [status, session] = await Promise.all([
      saspayRequest<CheckoutStatus>(`/checkout-sessions/${id}/status/`),
      saspayRequest<CheckoutSession>(`/checkout-sessions/${id}/`),
    ]);
    return {
      providerReference,
      status: toPaymentStatus(status.status),
      amount: parseAmount(session.amount),
    };
  },

  // SasPay's webhooks name the transaction, not the checkout session we
  // keep — the webhook route (app/api/webhooks/providers/saspay) verifies
  // the signature, then re-checks our pending SasPay payments instead.
  parseWebhook(): WebhookEvent {
    throw new Error("Webhook SasPay : utiliser la route dédiée.");
  },

  async refundPayment(): Promise<RefundResult> {
    throw new Error("Remboursement SasPay non pris en charge par l'API.");
  },
};
