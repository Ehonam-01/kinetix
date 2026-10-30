// A commission on a subscription paid only in part: the same share of the
// full-price commission as the share of the price actually paid. Nothing
// paid, nothing owed. Math.floor: XOF has no subunit (FINANCIAL_MODEL.md).
export function prorateCommission(
  fullCommission: number,
  pricePaid: number,
  fullPrice: number,
): number {
  if (fullPrice <= 0) return 0;
  const paid = Math.min(Math.max(pricePaid, 0), fullPrice);
  return Math.floor((fullCommission * paid) / fullPrice);
}
