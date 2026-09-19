// Shared by every mobile money operator picker (dashboard/withdrawals/
// withdrawal-form.tsx, dashboard/subscription/subscribe-button.tsx) — one
// list, one set of labels, matching db/schema/withdrawals.ts's
// mobile_money_operator enum values exactly.
export const MOBILE_MONEY_OPERATOR_OPTIONS = [
  { value: "MTN_MONEY", label: "MTN Money" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "WAVE_MONEY", label: "Wave" },
  { value: "MOOV_MONEY", label: "Moov Money" },
  { value: "MOBICASH", label: "Mobicash" },
  { value: "TOGOCELL", label: "T-Money (Togocel)" },
  { value: "FREE_MONEY", label: "Free Money" },
] as const;
