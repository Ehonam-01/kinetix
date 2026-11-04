import Image from "next/image";
import { cn } from "@/lib/utils";

// The two Mobile Money services the form takes (Togo), with the value
// the payment provider expects for each.
const PAYMENT_LOGOS = [
  {
    operator: "TOGOCELL",
    src: "/paiement-mixx-by-yas.png",
    alt: "Mixx by Yas",
    formerly: "ex T-Money",
    width: 960,
    height: 483,
  },
  {
    operator: "MOOV_MONEY",
    src: "/paiement-moov-money.png",
    alt: "Moov Money",
    formerly: "ex Flooz",
    width: 918,
    height: 612,
  },
] as const;

export function PaymentLogos({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 lg:justify-start",
        className,
      )}
    >
      {PAYMENT_LOGOS.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          sizes="5rem"
          className="h-12 w-auto rounded-md"
        />
      ))}
    </div>
  );
}

// Two choices only: both in view, each with its logo, rather than a list
// to open.
export function OperatorPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (operator: string) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium">
        Opérateur Mobile Money
      </legend>
      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_LOGOS.map((logo, i) => (
          <label
            key={logo.operator}
            className="has-checked:border-brand-accent has-checked:bg-brand-accent/5 has-checked:ring-brand-accent/30 has-focus-visible:ring-ring/50 flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-center has-checked:ring-2 has-focus-visible:ring-3"
          >
            <input
              type="radio"
              name={name}
              value={logo.operator}
              // One required radio makes the whole group required.
              required={i === 0}
              checked={value === logo.operator}
              onChange={() => onChange(logo.operator)}
              className="sr-only"
            />
            <Image
              src={logo.src}
              alt=""
              width={logo.width}
              height={logo.height}
              sizes="6rem"
              className="h-12 w-auto rounded-md"
            />
            <span className="text-sm leading-tight font-medium">
              {logo.alt}
              <span className="text-muted-foreground block text-xs font-normal">
                {logo.formerly}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
