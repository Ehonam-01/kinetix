import { cn } from "@/lib/utils";

// The yearly price on the payment screens, after the "tarif normal" set in
// admin → Paramètres, struck through, when there is one above the price.
export function PriceTag({
  price,
  regularPrice,
  className,
}: {
  price: number;
  regularPrice: number | null;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {regularPrice !== null && regularPrice > price && (
        <s className="text-muted-foreground tabular-nums">
          {regularPrice.toLocaleString("fr-FR")} F
        </s>
      )}
      <span className="text-foreground text-lg font-bold tabular-nums">
        {price.toLocaleString("fr-FR")} F CFA
      </span>
      <span className="text-muted-foreground text-sm">/ an</span>
    </p>
  );
}
