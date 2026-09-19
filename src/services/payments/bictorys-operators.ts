import type { mobileMoneyOperatorEnum } from "@/db/schema/withdrawals";

// Bictorys' payment_type values — shared by bictorys.ts's direct-softpay
// createPayment path and bictorys-payout.ts, mapped from this platform's
// own mobile_money_operator enum so neither ever spells out a
// Bictorys-specific string itself.
export const OPERATOR_TO_BICTORYS_PAYMENT_TYPE: Record<
  (typeof mobileMoneyOperatorEnum.enumValues)[number],
  string
> = {
  MTN_MONEY: "mtn_money",
  ORANGE_MONEY: "orange_money",
  WAVE_MONEY: "wave_money",
  MOOV_MONEY: "moov",
  MOBICASH: "mobicash",
  TOGOCELL: "togocell",
  FREE_MONEY: "free_money",
};
