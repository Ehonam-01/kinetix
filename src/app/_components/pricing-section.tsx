import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

const INCLUDED = [
  "Tout le catalogue de formations, sans payer chaque formation",
  "Les nouvelles formations ajoutées pendant l'année",
  "Autant de formations que tu veux, à ton rythme",
  "Des quiz pour valider chaque étape, ta progression sauvegardée",
  "La communauté des membres sur Discord",
  "L'accès au programme ambassadeur, si tu le souhaites",
];

// The subscription price, read from the admin parameter
// (subscription.price_in_cfa) by app/page.tsx. "Sans engagement" is
// literal: the subscription is never renewed automatically (see the terms,
// section 3) — it simply ends unless the member renews it. It is not a
// promise of a refund mid-year (terms, section 5).
//
// regularPrice (subscription.regular_price_in_cfa) is the price announced
// for after the launch: shown struck through with "Prix de lancement" only
// while it's above the current price, so setting it to 0 in the admin
// ends the launch offer on the page.
export function PricingSection({
  price,
  regularPrice,
}: {
  price: number;
  regularPrice: number | null;
}) {
  const perMonth = Math.round(price / 12);
  const launchOffer = regularPrice !== null && regularPrice > price;
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
                  {regularPrice.toLocaleString("fr-FR")} F
                </p>
              )}
              <p className="flex items-baseline justify-center gap-2 md:justify-start">
                <span className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl">
                  {price.toLocaleString("fr-FR")} F
                </span>
                <span className="text-muted-foreground text-lg">/ an</span>
              </p>
              <p className="text-muted-foreground text-sm">
                Soit environ {perMonth.toLocaleString("fr-FR")} F par mois, payé
                en une fois par mobile money.
              </p>
              {launchOffer && (
                <p className="text-sm font-medium">
                  Le tarif passera bientôt à{" "}
                  <strong>{regularPrice.toLocaleString("fr-FR")} F / an</strong>
                  . Profite du prix de lancement en t&apos;inscrivant
                  maintenant.
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
