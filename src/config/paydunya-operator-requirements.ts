import type { mobileMoneyOperatorEnum } from "@/db/schema/withdrawals";

type Operator = (typeof mobileMoneyOperatorEnum.enumValues)[number];
type Combo = `${string}:${Operator}`;

// Mirrors services/payments/paydunya.ts's OPERATOR_CONFIG requiresOtp/
// requiresAddress/responseKind flags — duplicated here as data only (no
// fetch logic, no secrets) so the subscription form, a client component,
// can decide which extra field to show without importing that
// "server-only" module. Keep in sync with paydunya.ts by hand; nothing
// enforces it automatically.
export const PAYDUNYA_REQUIRES_OTP = new Set<Combo>([
  "CI:ORANGE_MONEY",
  "BF:ORANGE_MONEY",
]);

export const PAYDUNYA_REQUIRES_ADDRESS = new Set<Combo>([
  "TG:MOOV_MONEY",
  "ML:ORANGE_MONEY",
  "ML:MOOV_MONEY",
]);

// Wizall Money (Sénégal) only — the one operator whose charge doesn't
// confirm itself; a second call with a customer-received authorization
// code is required (dashboard/subscription/actions.ts's
// confirmWizallPaymentAction).
export const PAYDUNYA_REQUIRES_WIZALL_CONFIRM = new Set<Combo>(["SN:WIZALL"]);
