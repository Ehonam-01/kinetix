import type { mobileMoneyOperatorEnum } from "@/db/schema/withdrawals";

type Operator = (typeof mobileMoneyOperatorEnum.enumValues)[number];

// PayDunya's own documented coverage (developers.paydunya.com/doc/FR/
// api_softpay_index) — unlike Bictorys (which publishes no such list, see
// config/bictorys-country-operators.ts's own disclaimer), this one is the
// real thing, not a guess. Cameroon (MTN) is in PayDunya's own coverage
// too but deliberately left out here — this platform's country list
// (config/bictorys-countries.ts) only ever covered the 6 Bictorys already
// used; add it there first if Cameroon members ever need to pay.
export const PAYDUNYA_OPERATORS_BY_COUNTRY: Record<string, Operator[]> = {
  SN: ["ORANGE_MONEY", "FREE_MONEY", "EXPRESSO", "WAVE_MONEY", "WIZALL", "DJAMO"],
  CI: ["ORANGE_MONEY", "MTN_MONEY", "MOOV_MONEY", "WAVE_MONEY", "DJAMO"],
  BJ: ["MOOV_MONEY", "MTN_MONEY", "CELTIIS_CASH"],
  BF: ["ORANGE_MONEY", "MOOV_MONEY"],
  TG: ["TOGOCELL", "MOOV_MONEY"],
  ML: ["ORANGE_MONEY", "MOOV_MONEY"],
};
