// Business bounds on admin-entered values (security audit L8). Admin
// actions already check types and signs (integers >= 0) — these add the
// upper bounds, mostly against typos on settings that move real money: a
// 5000 % commission rate, a free subscription, a recharge with a zero too
// many. Checked inside each service, so every caller (UI, scripts,
// AI-generated courses) goes through them.

// Titles, names, categories, short labels.
export const SHORT_TEXT_MAX = 200;
// Descriptions, refusal/refund reasons, quiz questions, prompts.
export const LONG_TEXT_MAX = 2000;
// A TEXT lesson's body is a full article — 2000 characters (about one
// page) would make real lessons impossible to write.
export const LESSON_CONTENT_MAX = 50_000;

// Commission rates are stored in basis points for PERCENTAGE and
// BV_PERCENTAGE rules (repositories/commission-rules.ts: rate / 10 000),
// so 100 % is 10 000.
export const PERCENTAGE_RATE_MAX = 10_000;

export const SUBSCRIPTION_PRICE_MIN = 100;
export const SUBSCRIPTION_PRICE_MAX = 1_000_000;

export const ADMIN_RECHARGE_MAX = 1_000_000;
// Withdrawal fees (/admin/parameters): at most 50 % of the amount (basis
// points) and 100 000 F fixed — guards against a typo, not a business rule.
export const WITHDRAWAL_FEE_PERCENT_BP_MAX = 5_000;
export const WITHDRAWAL_FEE_FIXED_MAX = 100_000;

export function assertMaxLength(
  value: string | null | undefined,
  max: number,
  label: string,
) {
  if (value && value.length > max) {
    throw new Error(
      `${label} : ${max.toLocaleString("fr-FR")} caractères maximum.`,
    );
  }
}

export function assertCommissionRate(commissionType: string, rate: number) {
  if (
    (commissionType === "PERCENTAGE" || commissionType === "BV_PERCENTAGE") &&
    rate > PERCENTAGE_RATE_MAX
  ) {
    throw new Error("Un taux en pourcentage ne peut pas dépasser 100 %.");
  }
}
