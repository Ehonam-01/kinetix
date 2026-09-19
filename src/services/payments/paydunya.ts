import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getPaydunyaEnv } from "@/config/env.paydunya";
import { SITE_NAME } from "@/config/site";
import type { mobileMoneyOperatorEnum } from "@/db/schema/withdrawals";
import type {
  CreatePaymentInput,
  PaymentIntent,
  PaymentProvider,
  PaymentStatus,
  RefundResult,
  VerifiedPayment,
  WebhookEvent,
} from "./provider";

// https://developers.paydunya.com/doc/FR/http_json (invoice create/confirm),
// /doc/FR/softpay (per-operator direct charge), /doc/FR/introduction (IPN
// hash). Two-step flow, unlike Bictorys' single call: an invoice is
// created first (get a token), then a second, operator-specific call
// actually pushes the charge — every operator has its OWN endpoint AND its
// own field names, hand-mapped below (see the config table), not a single
// generic payment_type parameter like Bictorys.
const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

type Operator = (typeof mobileMoneyOperatorEnum.enumValues)[number];

// Unlike Bictorys (which accepts "+228..."), PayDunya rejects a phone
// number with a country calling code prefix — caught live in production
// ("Désolé, vous devez fournir un numéro valide du Togo." for
// "+22891282590"), their own documented examples are all bare local
// numbers (e.g. "70707070" for Togo, no "+228"). Stripped here rather than
// relying on the form's own input format, so this holds regardless of how
// the member actually typed it (with "+", a leading "00", spaces, ...).
const COUNTRY_CALLING_CODES: Record<string, string> = {
  SN: "221",
  CI: "225",
  BJ: "229",
  BF: "226",
  TG: "228",
  ML: "223",
};

function toLocalPhoneNumber(phone: string, country: string): string {
  const digits = phone.replace(/\D/g, "");
  const callingCode = COUNTRY_CALLING_CODES[country];
  if (callingCode && digits.startsWith(callingCode)) {
    return digits.slice(callingCode.length);
  }
  return digits;
}

type ChargeFields = {
  name: string;
  email: string;
  phone: string;
  token: string;
  otp?: string;
  address?: string;
};

type OperatorConfig = {
  endpoint: string;
  responseKind: "push" | "redirect" | "wizall";
  requiresOtp?: boolean;
  requiresAddress?: boolean;
  buildBody: (fields: ChargeFields) => Record<string, unknown>;
};

// Every (country, operator) PayDunya documents (developers.paydunya.com/doc/
// FR/softpay) — hand-transcribed, not generated, because the field names
// have no consistent pattern across operators (some "customer_name", some
// "<operator>_fullName", some "<operator>_customer_fullname"...). Getting
// one of these wrong means a silent 400 from PayDunya, not a wrong charge —
// verify each combination with a small real payment before trusting it.
const OPERATOR_CONFIG: Partial<Record<`${string}:${Operator}`, OperatorConfig>> = {
  "SN:ORANGE_MONEY": {
    endpoint: "new-orange-money-senegal",
    responseKind: "push",
    buildBody: (f) => ({
      customer_name: f.name,
      customer_email: f.email,
      phone_number: f.phone,
      invoice_token: f.token,
    }),
  },
  "SN:WAVE_MONEY": {
    endpoint: "wave-senegal",
    responseKind: "redirect",
    buildBody: (f) => ({
      wave_senegal_fullName: f.name,
      wave_senegal_email: f.email,
      wave_senegal_phone: f.phone,
      wave_senegal_payment_token: f.token,
    }),
  },
  "SN:FREE_MONEY": {
    endpoint: "free-money-senegal",
    responseKind: "push",
    buildBody: (f) => ({
      customer_name: f.name,
      customer_email: f.email,
      phone_number: f.phone,
      payment_token: f.token,
    }),
  },
  "SN:EXPRESSO": {
    endpoint: "expresso-senegal",
    responseKind: "push",
    buildBody: (f) => ({
      expresso_sn_fullName: f.name,
      expresso_sn_email: f.email,
      expresso_sn_phone: f.phone,
      payment_token: f.token,
    }),
  },
  // The one operator whose initial call doesn't confirm the charge by
  // itself — see confirmWizallPayment below, and PaymentIntent's
  // pendingWizallConfirmation field.
  "SN:WIZALL": {
    endpoint: "wizall-money-senegal",
    responseKind: "wizall",
    buildBody: (f) => ({
      customer_name: f.name,
      customer_email: f.email,
      phone_number: f.phone,
      invoice_token: f.token,
    }),
  },
  "SN:DJAMO": {
    endpoint: "djamo",
    responseKind: "redirect",
    buildBody: (f) => ({
      djamo_fullName: f.name,
      djamo_email: f.email,
      djamo_phone: f.phone,
      code_country: "sn",
      djamo_payment_token: f.token,
    }),
  },
  "CI:ORANGE_MONEY": {
    endpoint: "orange-money-ci",
    responseKind: "push",
    requiresOtp: true,
    buildBody: (f) => ({
      orange_money_ci_customer_fullname: f.name,
      orange_money_ci_email: f.email,
      orange_money_ci_phone_number: f.phone,
      orange_money_ci_otp: f.otp,
      payment_token: f.token,
    }),
  },
  "CI:MTN_MONEY": {
    endpoint: "mtn-ci",
    responseKind: "push",
    buildBody: (f) => ({
      mtn_ci_customer_fullname: f.name,
      mtn_ci_email: f.email,
      mtn_ci_phone_number: f.phone,
      mtn_ci_wallet_provider: "MTNCI",
      payment_token: f.token,
    }),
  },
  "CI:MOOV_MONEY": {
    endpoint: "moov-ci",
    responseKind: "push",
    buildBody: (f) => ({
      moov_ci_customer_fullname: f.name,
      moov_ci_email: f.email,
      moov_ci_phone_number: f.phone,
      payment_token: f.token,
    }),
  },
  "CI:WAVE_MONEY": {
    endpoint: "wave-ci",
    responseKind: "redirect",
    buildBody: (f) => ({
      wave_ci_fullName: f.name,
      wave_ci_email: f.email,
      wave_ci_phone: f.phone,
      wave_ci_payment_token: f.token,
    }),
  },
  "CI:DJAMO": {
    endpoint: "djamo",
    responseKind: "redirect",
    buildBody: (f) => ({
      djamo_fullName: f.name,
      djamo_email: f.email,
      djamo_phone: f.phone,
      code_country: "ci",
      djamo_payment_token: f.token,
    }),
  },
  "BF:ORANGE_MONEY": {
    endpoint: "orange-money-burkina",
    responseKind: "push",
    requiresOtp: true,
    buildBody: (f) => ({
      name_bf: f.name,
      email_bf: f.email,
      phone_bf: f.phone,
      otp_code: f.otp,
      payment_token: f.token,
    }),
  },
  "BF:MOOV_MONEY": {
    endpoint: "moov-burkina",
    responseKind: "push",
    buildBody: (f) => ({
      moov_burkina_faso_fullName: f.name,
      moov_burkina_faso_email: f.email,
      moov_burkina_faso_phone_number: f.phone,
      moov_burkina_faso_payment_token: f.token,
    }),
  },
  "BJ:MOOV_MONEY": {
    endpoint: "moov-benin",
    responseKind: "push",
    buildBody: (f) => ({
      moov_benin_customer_fullname: f.name,
      moov_benin_email: f.email,
      moov_benin_phone_number: f.phone,
      payment_token: f.token,
    }),
  },
  "BJ:MTN_MONEY": {
    endpoint: "mtn-benin",
    responseKind: "push",
    buildBody: (f) => ({
      mtn_benin_customer_fullname: f.name,
      mtn_benin_email: f.email,
      mtn_benin_phone_number: f.phone,
      mtn_benin_wallet_provider: "MTNBENIN",
      payment_token: f.token,
    }),
  },
  "BJ:CELTIIS_CASH": {
    endpoint: "celtiis-cash",
    responseKind: "push",
    buildBody: (f) => ({
      celtiis_cash_customer_fullname: f.name,
      celtiis_cash_customer_email: f.email,
      celtiis_cash_phone_number: f.phone,
      payment_token: f.token,
    }),
  },
  "TG:TOGOCELL": {
    endpoint: "t-money-togo",
    responseKind: "push",
    buildBody: (f) => ({
      name_t_money: f.name,
      email_t_money: f.email,
      phone_t_money: f.phone,
      payment_token: f.token,
    }),
  },
  "TG:MOOV_MONEY": {
    endpoint: "moov-togo",
    responseKind: "push",
    requiresAddress: true,
    buildBody: (f) => ({
      moov_togo_customer_fullname: f.name,
      moov_togo_email: f.email,
      moov_togo_customer_address: f.address,
      moov_togo_phone_number: f.phone,
      payment_token: f.token,
    }),
  },
  "ML:ORANGE_MONEY": {
    endpoint: "orange-money-mali",
    responseKind: "push",
    requiresAddress: true,
    buildBody: (f) => ({
      orange_money_mali_customer_fullname: f.name,
      orange_money_mali_email: f.email,
      orange_money_mali_phone_number: f.phone,
      orange_money_mali_customer_address: f.address,
      payment_token: f.token,
    }),
  },
  "ML:MOOV_MONEY": {
    endpoint: "moov-mali",
    responseKind: "push",
    requiresAddress: true,
    buildBody: (f) => ({
      moov_ml_customer_fullname: f.name,
      moov_ml_email: f.email,
      moov_ml_phone_number: f.phone,
      moov_ml_customer_address: f.address,
      payment_token: f.token,
    }),
  },
};

function getOperatorConfig(country: string, operator: string): OperatorConfig {
  const config = OPERATOR_CONFIG[`${country}:${operator}` as `${string}:${Operator}`];
  if (!config) {
    throw new Error(
      `PayDunya ne supporte pas la combinaison pays/opérateur ${country}/${operator}.`,
    );
  }
  return config;
}

async function paydunyaRequest<T>(path: string, init: RequestInit): Promise<T> {
  const env = getPaydunyaEnv();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": env.PAYDUNYA_MASTER_KEY,
      "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY,
      "PAYDUNYA-TOKEN": env.PAYDUNYA_TOKEN,
      ...init.headers,
    },
  });

  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(
      `PayDunya ${path} a répondu ${response.status} : ${JSON.stringify(body)}`,
    );
  }
  return body;
}

type InvoiceCreateResponse = { response_code: string; response_text: string; token?: string };

async function createInvoice(
  input: CreatePaymentInput,
  localPhone: string | undefined,
): Promise<string> {
  const result = await paydunyaRequest<InvoiceCreateResponse>(
    "/checkout-invoice/create",
    {
      method: "POST",
      body: JSON.stringify({
        invoice: {
          total_amount: input.amount,
          description: input.description,
          customer: {
            name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
            email: input.customer.email,
            phone: localPhone,
          },
        },
        store: { name: SITE_NAME },
        actions: {
          callback_url: `${new URL(input.returnUrl).origin}/api/webhooks/providers/paydunya`,
          return_url: input.returnUrl,
          cancel_url: input.returnUrl,
        },
      }),
    },
  );

  if (result.response_code !== "00" || !result.token) {
    throw new Error(`PayDunya n'a pas pu créer la facture : ${result.response_text}`);
  }
  return result.token;
}

type SoftpayChargeResponse = {
  success: boolean;
  message: string;
  url?: string;
  data?: { TransactionID?: string; transactionid?: string };
};

function toPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case "completed":
      return "CONFIRMED";
    case "cancelled":
    case "failed":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export const paydunyaProvider: PaymentProvider = {
  name: "PAYDUNYA",

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntent> {
    if (!input.country || !input.operator) {
      throw new Error("PayDunya nécessite un pays et un opérateur.");
    }
    const config = getOperatorConfig(input.country, input.operator);
    if (config.requiresOtp && !input.otp) {
      throw new Error("Un code de confirmation (USSD) est requis pour cet opérateur.");
    }
    if (config.requiresAddress && !input.address) {
      throw new Error("Une adresse est requise pour cet opérateur.");
    }
    if (!input.customer.phone) {
      throw new Error("Un numéro de téléphone est requis.");
    }
    const localPhone = toLocalPhoneNumber(input.customer.phone, input.country);

    // The invoice token doubles as our providerReference: PayDunya's IPN
    // payload identifies the transaction by it (invoice.token), same as
    // Bictorys' transactionId — see parseWebhook/verifyPayment below.
    const token = await createInvoice(input, localPhone);

    const result = await paydunyaRequest<SoftpayChargeResponse>(
      `/softpay/${config.endpoint}`,
      {
        method: "POST",
        body: JSON.stringify(
          config.buildBody({
            name: `${input.customer.firstName} ${input.customer.lastName}`.trim(),
            email: input.customer.email,
            phone: localPhone,
            token,
            otp: input.otp,
            address: input.address,
          }),
        ),
      },
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    if (config.responseKind === "redirect") {
      if (!result.url) {
        throw new Error("PayDunya n'a renvoyé aucune URL de paiement.");
      }
      return { providerReference: token, checkoutUrl: result.url };
    }

    if (config.responseKind === "wizall") {
      const transactionId = result.data?.TransactionID ?? result.data?.transactionid;
      if (!transactionId) {
        throw new Error("PayDunya n'a renvoyé aucun identifiant de transaction Wizall.");
      }
      return {
        providerReference: token,
        checkoutUrl: null,
        confirmationMessage:
          "Un code de confirmation vous a été envoyé — saisissez-le pour finaliser le paiement.",
        pendingWizallConfirmation: { transactionId },
      };
    }

    return {
      providerReference: token,
      checkoutUrl: null,
      confirmationMessage: result.message,
    };
  },

  async verifyPayment(providerReference: string): Promise<VerifiedPayment> {
    const result = await paydunyaRequest<{
      status: string;
      invoice?: { total_amount?: number };
    }>(`/checkout-invoice/confirm/${providerReference}`, { method: "GET" });

    return {
      providerReference,
      status: toPaymentStatus(result.status),
      amount: result.invoice?.total_amount ?? 0,
    };
  },

  // Best-effort: the exact wire format of PayDunya's IPN isn't fully
  // documented (their own docs give conflicting examples — a nested
  // {data: {...}} JSON structure in one place, flat form-urlencoded fields
  // in another) — handled defensively here for both shapes. This is why
  // dashboard/subscription/actions.ts's polling never relies on this
  // alone: it actively re-verifies via verifyPayment (the well-documented
  // GET confirm endpoint) instead of waiting on the webhook to have
  // already landed.
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent {
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      payload = (parsed.data ?? parsed) as Record<string, unknown>;
    } catch {
      const params = new URLSearchParams(rawBody);
      const dataField = params.get("data");
      if (dataField) {
        payload = JSON.parse(dataField);
      } else {
        payload = Object.fromEntries(params.entries());
      }
    }

    const schema = z.object({
      hash: z.string(),
      status: z.string(),
      invoice: z.object({ token: z.string() }).optional(),
      token: z.string().optional(),
    });
    const event = schema.parse(payload);
    const reference = event.invoice?.token ?? event.token;
    if (!reference) {
      throw new Error("Webhook PayDunya reçu sans référence de facture.");
    }

    // Not an HMAC over the payload — PayDunya's hash is a fixed
    // SHA-512(masterKey), the same value on every callback for this
    // account. Still compared with timingSafeEqual for the same reason as
    // every other secret comparison in this codebase.
    const expected = createHash("sha512")
      .update(getPaydunyaEnv().PAYDUNYA_MASTER_KEY)
      .digest("hex");
    const receivedBuffer = Buffer.from(event.hash);
    const expectedBuffer = Buffer.from(expected);
    const validHash =
      receivedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(receivedBuffer, expectedBuffer);
    if (!validHash) {
      throw new Error("Hash de webhook PayDunya invalide.");
    }
    void signature; // PayDunya carries its signature in the body (hash), not a header.

    return {
      providerReference: reference,
      status: toPaymentStatus(event.status),
      eventType: event.status,
      dedupeKey: `${reference}:${event.status}`,
      raw: payload,
    };
  },

  async refundPayment(): Promise<RefundResult> {
    throw new Error("PayDunya ne documente aucun endpoint de remboursement à ce jour.");
  },
};

// Wizall Money (Sénégal) only — see the "wizall" responseKind above.
// Called from a second UI step once the member has received their
// authorization code by SMS.
export async function confirmWizallPayment(
  transactionId: string,
  phone: string,
  authorizationCode: string,
): Promise<void> {
  const result = await paydunyaRequest<{ success: boolean; message: string }>(
    "/softpay/wizall-money-senegal/confirm",
    {
      method: "POST",
      body: JSON.stringify({
        authorization_code: authorizationCode,
        phone_number: phone,
        transaction_id: transactionId,
      }),
    },
  );
  if (!result.success) {
    throw new Error(result.message);
  }
}
