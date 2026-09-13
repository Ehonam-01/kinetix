import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getMonerooEnv } from "@/config/env.moneroo";
import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  RefundResult,
  VerifiedPayment,
  WebhookEvent,
} from "./provider";

// https://docs.moneroo.io/payments/standard-integration.md,
// /payments/transaction-verification.md, /introduction/webhooks.md
const BASE_URL = "https://api.moneroo.io";

type MonerooInitializeResponse = {
  data: { id: string; checkout_url: string };
};

type MonerooVerifyResponse = {
  data: {
    id: string;
    status: "success" | "pending" | "failed";
    amount: number;
  };
};

// Signature verification proves the payload came from Moneroo, not that
// it has the shape we expect — validated separately before use.
const monerooWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.number(),
  }),
});

function toPaymentStatus(monerooStatus: string): PaymentStatus {
  switch (monerooStatus) {
    case "success":
      return "CONFIRMED";
    case "failed":
    case "cancelled":
      return "FAILED";
    default:
      return "PENDING";
  }
}

async function monerooRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getMonerooEnv().MONEROO_SECRET_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Moneroo ${path} a répondu ${response.status} : ${body}`);
  }

  return response.json() as Promise<T>;
}

export const monerooProvider: PaymentProvider = {
  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    const result = await monerooRequest<MonerooInitializeResponse>(
      "/v1/payments/initialize",
      {
        method: "POST",
        body: JSON.stringify({
          amount: input.amount,
          currency: "XOF",
          description: input.description,
          customer: {
            email: input.customer.email,
            first_name: input.customer.firstName,
            last_name: input.customer.lastName,
            phone: input.customer.phone,
          },
          return_url: input.returnUrl,
          metadata: input.metadata,
        }),
      },
    );

    return {
      providerReference: result.data.id,
      checkoutUrl: result.data.checkout_url,
    };
  },

  async verifyPayment(providerReference: string): Promise<VerifiedPayment> {
    const result = await monerooRequest<MonerooVerifyResponse>(
      `/v1/payments/${providerReference}/verify`,
      { method: "GET" },
    );

    return {
      providerReference: result.data.id,
      status: toPaymentStatus(result.data.status),
      amount: result.data.amount,
    };
  },

  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    if (!signature) {
      throw new Error("Webhook Moneroo reçu sans en-tête de signature.");
    }

    const expected = createHmac(
      "sha256",
      getMonerooEnv().MONEROO_WEBHOOK_SECRET,
    )
      .update(rawBody)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    const validSignature =
      signatureBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!validSignature) {
      throw new Error("Signature de webhook Moneroo invalide.");
    }

    const payload = monerooWebhookSchema.parse(JSON.parse(rawBody));

    return {
      providerReference: payload.data.id,
      status: toPaymentStatus(payload.data.status),
      eventType: payload.event,
      // Moneroo sends no unique event id and warns deliveries can repeat
      // (introduction/webhooks.md) — derived instead, stable across
      // redeliveries of the same event, distinct across different events.
      dedupeKey: `${payload.event}:${payload.data.id}`,
      raw: payload,
    };
  },

  async refundPayment(): Promise<RefundResult> {
    throw new Error(
      "Moneroo ne documente aucun endpoint de remboursement à ce jour.",
    );
  },
};
