import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  lastLaunchDayLabel,
  type LaunchOffer,
} from "@/services/pricing/launch-offer";
import { LaunchCountdown } from "@/components/launch-countdown";
import { splitTranches } from "@/lib/split-payment";
import { INSTALLMENT_MONTHS } from "@/services/subscriptions/installments";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { formatPrice } from "@/lib/format-price";

const INCLUDED = [
  "Tout le catalogue de formations, sans payer chaque formation",
  "Les nouvelles formations ajoutées pendant l'année",
  "Autant de formations que tu veux, à ton rythme",
  "Des quiz pour valider chaque étape, ta progression sauvegardée",
  "La communauté des membres sur WhatsApp et Discord",
  "L'accès au programme ambassadeur, si tu le souhaites",
];

// The subscription price, read from the admin parameter
// (subscription.price_in_cfa) by app/page.tsx. "Sans engagement" is
// literal: the subscription is never renewed automatically (see the terms,
// section 3) — it simply ends unless the member renews it. It is not a
// promise of a refund mid-year (terms, section 5).
//
// The launch offer (services/pricing/launch-offer.ts): the price announced
// for after the launch, struck through, and — once the admin has
// programmed the end date — the last day, a countdown and the amount saved.
export function PricingSection({ offer }: { offer: LaunchOffer }) {
  const { price, nextPrice: regularPrice, endsAt, savings } = offer;
  const perMonth = Math.round(price / 12);
  const launchOffer = regularPrice !== null;
  // Paying in 3 times (lib/split-payment.ts), put forward (explicit user
  // decision): the same tranches the subscription page offers.
  const tranches = splitTranches(price);
  return (
    <section id="tarif" className="bg-muted/40 scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center">
            <span className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
              Abonnement
            </span>
            <h2 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Un seul abonnement, tout inclus.
            </h2>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="border-border bg-card mx-auto mt-12 grid max-w-4xl overflow-hidden rounded-3xl border shadow-xl md:grid-cols-[1fr_1.2fr]">
            <div className="bg-brand-accent/10 flex flex-col justify-center gap-4 p-8 text-center sm:p-10 md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <p className="font-semibold">Abonnement annuel</p>
                {launchOffer && (
                  <span className="bg-brand-accent text-brand-accent-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    <Sparkles className="size-3" />
                    Prix de lancement
                  </span>
                )}
              </div>
              {launchOffer && (
                <p className="text-muted-foreground -mb-3 text-xl font-semibold tabular-nums line-through">
                  {formatPrice(regularPrice)}
                </p>
              )}
              <p className="flex items-baseline justify-center gap-2 md:justify-start">
                <span className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
                  {formatPrice(price)}
                </span>
                <span className="text-muted-foreground text-lg">/ an</span>
              </p>
              <p className="text-muted-foreground text-sm">
                Soit environ {formatPrice(perMonth)} par mois, par mobile money.
              </p>
              {tranches && (
                <div className="border-brand-accent bg-background/80 rounded-2xl border-2 p-4 text-left">
                  <p className="text-brand-accent flex items-center gap-1.5 text-sm font-bold tracking-wide uppercase">
                    <CalendarClock className="size-4" />
                    Ou paie en 3 fois
                  </p>
                  <p className="mt-2 text-sm">
                    <strong className="text-base">
                      {formatPrice(tranches[0])} aujourd&apos;hui
                    </strong>
                    , puis{" "}
                    <strong>
                      {tranches[1] === tranches[2]
                        ? `2 × ${formatPrice(tranches[1])}`
                        : `${formatPrice(tranches[1])} et ${formatPrice(tranches[2])}`}
                    </strong>{" "}
                    quand tu veux, dans les {INSTALLMENT_MONTHS} mois.
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Ton accès s&apos;ouvre dès la première tranche. Paiement en
                    3 fois par mobile money, selon ton pays.
                  </p>
                </div>
              )}
              {launchOffer && endsAt && (
                <div className="border-brand-accent/40 bg-background/70 space-y-3 rounded-2xl border p-4 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-sm font-semibold">
                    <Clock className="text-brand-accent size-4" />
                    Prix de lancement jusqu&apos;au {lastLaunchDayLabel(endsAt)}
                  </p>
                  <LaunchCountdown
                    endsAt={endsAt}
                    boxClassName="bg-brand-accent/15"
                    labelClassName="text-muted-foreground"
                  />
                  <p className="text-sm">
                    Ensuite : <strong>{formatPrice(regularPrice)} / an</strong>.
                    En t&apos;inscrivant maintenant, tu économises{" "}
                    <strong className="text-brand-accent">
                      {formatPrice(savings ?? 0)}
                    </strong>
                    .
                  </p>
                </div>
              )}
              {launchOffer && !endsAt && (
                <p className="text-sm font-medium">
                  Le tarif passera bientôt à{" "}
                  <strong>{formatPrice(regularPrice)} / an</strong>. Profite du
                  prix de lancement en t&apos;inscrivant maintenant.
                </p>
              )}
              <div className="flex items-start justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-left text-sm md:justify-start">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    Sans engagement.
                  </strong>{" "}
                  Aucun renouvellement automatique : à la fin de l&apos;année,
                  tu renouvelles seulement si tu le souhaites. Tu arrêtes quand
                  tu veux.
                </span>
              </div>
              <Link
                href="/register"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-12 text-base",
                )}
              >
                Rejoindre Kinetix
              </Link>
            </div>
            <ul className="space-y-3.5 p-8 sm:p-10">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-base">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
