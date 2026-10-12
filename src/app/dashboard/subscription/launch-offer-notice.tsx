import { Clock } from "lucide-react";
import { LaunchCountdown } from "@/components/launch-countdown";

// Above the payment methods (subscription page and the "Finalisez votre
// inscription" screen), while an end date for the launch price is
// programmed. A cagnotte keeps the price of the day its first deposit is
// started (installments.ts: targetAmount), hence the second line.
export function LaunchOfferNotice({
  offer,
}: {
  offer: {
    price: number;
    nextPrice: number;
    endsAt: string;
    lastDayLabel: string;
    withInstallments: boolean;
  };
}) {
  const fmt = (n: number) => `${n.toLocaleString("fr-FR")} F`;
  return (
    <div className="border-brand-accent/40 bg-brand-accent/10 space-y-3 rounded-xl border p-3 text-center text-sm">
      <p className="flex items-center justify-center gap-1.5 font-semibold">
        <Clock className="text-brand-accent size-4 shrink-0" />
        {fmt(offer.price)} jusqu&apos;au {offer.lastDayLabel}, puis{" "}
        {fmt(offer.nextPrice)}
      </p>
      <LaunchCountdown
        endsAt={offer.endsAt}
        boxClassName="bg-background/80 min-w-12"
        labelClassName="text-muted-foreground"
      />
      <p className="text-muted-foreground text-xs">
        Tu économises {fmt(offer.nextPrice - offer.price)} en payant avant cette
        date.
        {offer.withInstallments &&
          ` Pas tout de suite ? Fais ton premier versement « En plusieurs fois » avant cette date : ta cagnotte garde le prix de ${fmt(offer.price)}.`}
      </p>
    </div>
  );
}
