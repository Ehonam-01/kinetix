// Paying the first subscription in 3 times (explicit user decision): a
// fixed first tranche, which opens the subscription right away, then what
// is left in two equal tranches, paid whenever the member wants as long as
// everything is paid within the deadline (services/subscriptions/
// installments.ts). The last tranche absorbs the odd franc.
export const SPLIT_FIRST_TRANCHE = 25_000;

// The three tranches for a price, or null when the price doesn't leave
// anything after the first one (paying in 3 times isn't offered then).
export function splitTranches(price: number): [number, number, number] | null {
  const rest = price - SPLIT_FIRST_TRANCHE;
  if (rest <= 0) return null;
  const second = Math.ceil(rest / 2);
  return [SPLIT_FIRST_TRANCHE, second, rest - second];
}

// What the member may pay now: the first tranche alone to start, then
// either the next tranche or everything left at once. Empty when nothing
// can be started (all paid, or the rest already being confirmed).
export function splitPaymentChoices(
  target: number,
  paid: number,
  pending: number,
): number[] {
  const tranches = splitTranches(target);
  if (!tranches) return [];
  const left = target - paid - pending;
  if (left <= 0) return [];
  if (paid + pending === 0) return [tranches[0]];
  // Before the first tranche is confirmed, nothing else can start.
  if (paid === 0) return [];
  const next = Math.min(tranches[1], left);
  return next === left ? [left] : [next, left];
}
