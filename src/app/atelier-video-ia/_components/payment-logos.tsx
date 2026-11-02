import Image from "next/image";
import { cn } from "@/lib/utils";

// The two Mobile Money services the form takes (Togo).
const PAYMENT_LOGOS = [
  {
    src: "/paiement-mixx-by-yas.png",
    alt: "Mixx by Yas",
    width: 960,
    height: 483,
  },
  {
    src: "/paiement-moov-money.png",
    alt: "Moov Money",
    width: 918,
    height: 612,
  },
];

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
