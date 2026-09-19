import type { mobileMoneyOperatorEnum } from "@/db/schema/withdrawals";

type Operator = (typeof mobileMoneyOperatorEnum.enumValues)[number];

// Best-effort mapping from general telecom-market knowledge — Bictorys
// doesn't publish an authoritative country/operator list (checked their
// docs directly, see bictorys.ts and bictorys-payout.ts's country
// comments). BJ (Bénin) is the one row actually confirmed against
// Bictorys' own hosted checkout page, which showed exactly MTN Money +
// Moov for that country and nothing else — every other row is a
// reasonable guess, not a verified fact, and should be corrected if a
// member reports a missing or wrongly-offered operator for their country.
export const OPERATORS_BY_COUNTRY: Record<string, Operator[]> = {
  SN: ["ORANGE_MONEY", "WAVE_MONEY", "FREE_MONEY"],
  CI: ["ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "WAVE_MONEY"],
  BJ: ["MTN_MONEY", "MOOV_MONEY"],
  BF: ["ORANGE_MONEY", "MOOV_MONEY"],
  ML: ["ORANGE_MONEY", "MOOV_MONEY"],
  TG: ["TOGOCELL", "MOOV_MONEY", "MOBICASH"],
};
