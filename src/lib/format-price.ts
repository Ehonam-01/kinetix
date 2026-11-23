// Every price on the public pages, written the same way: thousands
// separated by a narrow no-break space, a no-break space before "F", so
// "45 000 F" never breaks across two lines. By hand rather than
// toLocaleString: the same text on the server and in every browser (some
// phones' browsers group digits differently, or not at all).
export function formatAmount(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return (
    sign +
    String(Math.abs(Math.round(amount))).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      "\u202f",
    )
  );
}

export function formatPrice(amount: number): string {
  return `${formatAmount(amount)}\u00a0F`;
}
