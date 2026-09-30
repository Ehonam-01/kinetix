// The fee charged on a withdrawal, deducted from the amount withdrawn: the
// balance is debited `amount`, the member receives `net`. A percentage of
// the amount (basis points, 150 = 1,5 %) plus a fixed amount, both set by
// the admin (parameters withdrawal.fee_percent_bp and withdrawal.fee_fixed).
// Pure, shared by the server (services/wallet/request-withdrawal.ts, which
// snapshots the fee on the request) and the form that previews it.
export type WithdrawalFeeSettings = { percentBp: number; fixed: number };

export function computeWithdrawalFee(
  amount: number,
  settings: WithdrawalFeeSettings,
): { fee: number; net: number } {
  // floor, like every amount in this codebase (no subunit in F CFA) — the
  // rounding favours the member.
  const fee =
    Math.floor((amount * settings.percentBp) / 10_000) + settings.fixed;
  return { fee, net: amount - fee };
}

// "1,5 % + 100 F", "2 %", "100 F" — or null when there's no fee.
export function describeWithdrawalFee(settings: WithdrawalFeeSettings) {
  const parts: string[] = [];
  if (settings.percentBp > 0) {
    parts.push(
      `${(settings.percentBp / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`,
    );
  }
  if (settings.fixed > 0) {
    parts.push(`${settings.fixed.toLocaleString("fr-FR")} F`);
  }
  return parts.length ? parts.join(" + ") : null;
}
