import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { getPaydunyaEnv } from "@/config/env.paydunya";
import { getPaydunyaWithdrawMode } from "@/config/paydunya-payout-operators";
import { toLocalPhoneNumber } from "./paydunya";
import { PayoutRejectedError, PayoutUncertainError } from "./payout-errors";

// PayDunya disbursement ("API PUSH", developers.paydunya.com/doc/FR/
// api_deboursement) — withdrawals are paid from the same PayDunya account
// subscriptions are collected into, so no manual top-up of a second
// provider is needed (the Bictorys payout path, bictorys-payout.ts, stays
// in the codebase but unused). Two steps: get-invoice creates a
// disbursement (nothing moves yet), submit-invoice sends it to the
// operator. check-status is the source of truth for the outcome. PayDunya
// documents no sandbox for this API: every call is a real transfer.
const BASE_URL = "https://app.paydunya.com/api/v2/disburse";

export type PaydunyaPayoutStatus = "created" | "pending" | "success" | "failed";

type DisburseResponse = {
  response_code?: string | number;
  response_text?: string;
  disburse_token?: string;
  status?: string;
};

async function disburseRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<DisburseResponse> {
  const env = getPaydunyaEnv();
  const response = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": env.PAYDUNYA_MASTER_KEY,
      "PAYDUNYA-PRIVATE-KEY": env.PAYDUNYA_PRIVATE_KEY,
      "PAYDUNYA-TOKEN": env.PAYDUNYA_TOKEN,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const parsed = (await response.json().catch(() => ({}))) as DisburseResponse;
  if (!response.ok || String(parsed.response_code) !== "00") {
    console.error(`PayDunya disburse/${path} :`, response.status, parsed);
  }
  return parsed;
}

// PayDunya's documented error codes, turned into something an admin can
// act on (security audit M8: never a raw provider body in front of a user).
export function explainDisburseError(response: DisburseResponse): string {
  switch (String(response.response_code)) {
    case "4002":
      return "Solde PayDunya insuffisant pour ce virement (ou URL de confirmation injoignable). Approvisionnez votre compte PayDunya puis réessayez.";
    case "401":
      return "Déboursement non autorisé : activez l'API de déboursement (PER) dans votre tableau de bord PayDunya.";
    case "1001":
      return "Cet opérateur n'est pas pris en charge par le déboursement PayDunya.";
    case "5000":
      return "Service de déboursement PayDunya momentanément indisponible. Réessayez plus tard.";
    default:
      return response.response_text
        ? `PayDunya a refusé le virement : ${response.response_text}`
        : "PayDunya a refusé le virement.";
  }
}

export async function checkPaydunyaPayoutStatus(
  token: string,
): Promise<PaydunyaPayoutStatus> {
  const response = await disburseRequest("check-status", {
    disburse_invoice: token,
  });
  const status = response.status;
  if (
    String(response.response_code) !== "00" ||
    (status !== "created" &&
      status !== "pending" &&
      status !== "success" &&
      status !== "failed")
  ) {
    throw new Error(explainDisburseError(response));
  }
  return status;
}

export async function createPaydunyaPayout(input: {
  amount: number;
  phone: string;
  operator: string;
  country: string;
  // Our own reference for this attempt — PayDunya refuses one it has
  // already seen, so the same attempt can never be paid twice.
  disburseId: string;
  callbackUrl: string;
}): Promise<{
  payoutProviderReference: string;
  status: "pending" | "success";
}> {
  const withdrawMode = getPaydunyaWithdrawMode(input.country, input.operator);
  if (!withdrawMode) {
    throw new PayoutRejectedError(
      "Cet opérateur n'est pas pris en charge par le déboursement PayDunya pour ce pays.",
    );
  }

  // Step 1 — creates the disbursement only. Whatever goes wrong here
  // (refusal, network), nothing has been sent to the operator yet.
  let invoice: DisburseResponse;
  try {
    invoice = await disburseRequest("get-invoice", {
      account_alias: toLocalPhoneNumber(input.phone, input.country),
      amount: input.amount,
      withdraw_mode: withdrawMode,
      callback_url: input.callbackUrl,
    });
  } catch {
    throw new PayoutRejectedError(
      "PayDunya ne répond pas. Aucun virement n'a été envoyé ; réessayez.",
    );
  }
  const token = invoice.disburse_token;
  if (String(invoice.response_code) !== "00" || !token) {
    throw new PayoutRejectedError(explainDisburseError(invoice));
  }

  // Step 2 — actually sends the money. Its answer alone is never trusted:
  // the outcome always comes from check-status, as PayDunya's docs
  // recommend whenever submit doesn't return a clean "00".
  let submitted: DisburseResponse | null = null;
  try {
    submitted = await disburseRequest("submit-invoice", {
      disburse_invoice: token,
      disburse_id: input.disburseId,
    });
  } catch {
    submitted = null;
  }

  let status: PaydunyaPayoutStatus;
  try {
    status = await checkPaydunyaPayoutStatus(token);
  } catch {
    throw new PayoutUncertainError(
      "Résultat du virement incertain : cliquez sur « Vérifier le statut » avant toute nouvelle action.",
      token,
    );
  }

  if (status === "created") {
    // Never reached the operator.
    throw new PayoutRejectedError(
      submitted ? explainDisburseError(submitted) : "Le virement n'a pas pu être envoyé ; réessayez.",
    );
  }
  if (status === "failed") {
    throw new PayoutRejectedError("Le virement a été refusé par l'opérateur mobile money.");
  }
  return { payoutProviderReference: token, status };
}

// PayDunya's callback carries its "hash" (SHA-512 of the master key, a
// constant) in the body, JSON or form-encoded depending on the docs page.
// Only used to recognise the token to re-check — the outcome itself always
// comes from checkPaydunyaPayoutStatus, never from the callback's content.
export function parsePaydunyaPayoutCallback(rawBody: string): string {
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    payload = (parsed?.data ?? parsed) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(rawBody);
    const data = params.get("data");
    payload = data ? JSON.parse(data) : Object.fromEntries(params.entries());
  }

  const hash = typeof payload.hash === "string" ? payload.hash : "";
  const expected = createHash("sha512")
    .update(getPaydunyaEnv().PAYDUNYA_MASTER_KEY)
    .digest("hex");
  const received = Buffer.from(hash);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length || !timingSafeEqual(received, wanted)) {
    throw new Error("Hash de callback PayDunya invalide.");
  }
  if (typeof payload.token !== "string" || !payload.token) {
    throw new Error("Callback PayDunya sans token.");
  }
  return payload.token;
}
