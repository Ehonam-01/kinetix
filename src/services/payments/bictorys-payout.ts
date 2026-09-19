import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getBictorysEnv, getBictorysPayoutSecretCode } from "@/config/env.bictorys";
import type { mobileMoneyOperatorEnum } from "@/db/schema/withdrawals";
import { OPERATOR_TO_BICTORYS_PAYMENT_TYPE } from "./bictorys-operators";

// https://docs.bictorys.com/reference/createpayout — single (non-batch)
// payout, distinct from PaymentProvider (services/payments/provider.ts,
// inbound charges only). Withdrawal automation is Bictorys-only: Moneroo
// has no payout integration configured (see the withdrawal_requests schema
// comment), so this isn't behind the same provider-selector.ts toggle as
// charges — approveWithdrawal (services/admin/approve-withdrawal.ts) calls
// it directly.
const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.bictorys.com"
    : "https://api.test.bictorys.com";

const payoutResponseSchema = z.object({ id: z.string() });

export type CreatePayoutInput = {
  amount: number;
  phone: string;
  operator: (typeof mobileMoneyOperatorEnum.enumValues)[number];
  // ISO 3166-1 alpha-2 — chosen by the member on the withdrawal form
  // (config/bictorys-countries.ts), same as the payment side.
  country: string;
  recipientName: string;
};

export type PayoutResult = { payoutProviderReference: string };

// Returns once Bictorys has *accepted* the payout request (201) — this is
// not confirmation the money arrived. approveWithdrawal stores
// payoutProviderReference and leaves the request in PROCESSING;
// handle-payout-webhook.ts moves it to PAID only once Bictorys' webhook
// confirms the transfer actually succeeded.
export async function createBictorysPayout(
  input: CreatePayoutInput,
): Promise<PayoutResult> {
  const paymentType = OPERATOR_TO_BICTORYS_PAYMENT_TYPE[input.operator];
  const response = await fetch(
    `${BASE_URL}/pay/v1/payouts?payment_type=${paymentType}&country_code=${input.country}`,
    {
      method: "POST",
      headers: {
        "X-API-Key": getBictorysEnv().BICTORYS_SECRET_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: "XOF",
        country: input.country,
        transactionType: "transfer",
        // A bare UUID, not a compound string — see bictorys.ts's
        // createPayment for the same fix and why (Bictorys rejects
        // anything else with "E400-46: Invalid merchantReference format",
        // caught live against the charges endpoint). Purely informational
        // on our side either way: approveWithdrawal matches the webhook
        // back to this payout via payoutProviderReference (Bictorys' own
        // returned id), never via merchantReference.
        merchantReference: randomUUID(),
        customerObject: {
          name: input.recipientName,
          phone: input.phone,
        },
        merchant: { secretCode: getBictorysPayoutSecretCode() },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Bictorys /pay/v1/payouts a répondu ${response.status} : ${body}`,
    );
  }

  const result = payoutResponseSchema.parse(await response.json());
  return { payoutProviderReference: result.id };
}
