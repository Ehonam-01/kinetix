import { Check } from "lucide-react";
import { Reveal } from "@/app/_components/reveal";

const BENEFITS = [
  "Un lien de parrainage personnel à partager",
  "Une commission sur chaque vente directe que tu apportes",
  "Des commissions de génération sur le volume de ton équipe",
  "Un tableau de bord pour suivre tes ventes et commissions",
  "Des retraits vers mobile money",
  "Un parcours de progression, du niveau Bronze à Diamant",
];

export function PaBenefits() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Pourquoi devenir ambassadeur
          </h2>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BENEFITS.map((benefit) => (
              <div
                key={benefit}
                className="border-border bg-card flex items-center gap-3 rounded-xl border p-4"
              >
                <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="size-3.5" />
                </span>
                <span className="text-sm font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
