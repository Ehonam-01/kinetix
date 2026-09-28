import type {
  bictorysCountryEnum,
  mobileMoneyOperatorEnum,
} from "@/db/schema/withdrawals";

type Operator = (typeof mobileMoneyOperatorEnum.enumValues)[number];
type Country = (typeof bictorysCountryEnum.enumValues)[number];

// PayDunya's disbursement ("API PUSH") withdraw_mode values, transcribed from
// developers.paydunya.com/doc/FR/api_deboursement — not the same coverage as
// PayDunya's inbound softpay (config/paydunya-country-operators.ts): Mali
// only offers Orange Money for payouts, Togo T-Money and Moov (no
// Mobicash). Limited to the withdrawal_requests country enum; Cameroon
// (mtn-cameroun, XAF) isn't a withdrawal country.
const WITHDRAW_MODES: Record<Country, Partial<Record<Operator, string>>> = {
  SN: {
    ORANGE_MONEY: "orange-money-senegal",
    FREE_MONEY: "free-money-senegal",
    EXPRESSO: "expresso-senegal",
    WAVE_MONEY: "wave-senegal",
    DJAMO: "djamo-sn",
  },
  CI: {
    ORANGE_MONEY: "orange-money-ci",
    MTN_MONEY: "mtn-ci",
    MOOV_MONEY: "moov-ci",
    WAVE_MONEY: "wave-ci",
    DJAMO: "djamo-ci",
  },
  BJ: {
    MTN_MONEY: "mtn-benin",
    MOOV_MONEY: "moov-benin",
    CELTIIS_CASH: "celtiis-cash",
  },
  BF: {
    ORANGE_MONEY: "orange-money-burkina",
    MOOV_MONEY: "moov-burkina-faso",
  },
  ML: {
    ORANGE_MONEY: "orange-money-mali",
  },
  TG: {
    TOGOCELL: "t-money-togo",
    MOOV_MONEY: "moov-togo",
  },
};

export function getPaydunyaWithdrawMode(
  country: string,
  operator: string,
): string | null {
  return WITHDRAW_MODES[country as Country]?.[operator as Operator] ?? null;
}

// For the member's withdrawal form: only the operators a payout can
// actually be sent to, per country.
export const PAYDUNYA_PAYOUT_OPERATORS_BY_COUNTRY: Record<string, Operator[]> =
  Object.fromEntries(
    Object.entries(WITHDRAW_MODES).map(([country, modes]) => [
      country,
      Object.keys(modes) as Operator[],
    ]),
  );
