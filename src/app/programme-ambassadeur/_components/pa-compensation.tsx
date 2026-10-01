import { Reveal } from "@/app/_components/reveal";
import type { CompensationData } from "../data";

// How many referred subscribers the worked example shows — always computed
// from the live price and direct rate (data.ts), never typed by hand.
const REFERRAL_EXAMPLES = [1, 5, 10];

export function PaCompensation({ data }: { data: CompensationData }) {
  return (
    <section id="remuneration" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Comment fonctionne la rémunération
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Simple : une souscription réelle, une commission réelle.
            </p>
          </div>
        </Reveal>

        {data.directRatePercent != null && (
          <Reveal delayMs={100}>
            <div className="border-border bg-card mt-12 rounded-2xl border p-6 sm:p-8">
              <h3 className="font-heading text-lg font-semibold">
                Commission directe
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Lorsqu&apos;un ambassadeur apporte directement un nouvel abonné
                grâce à son lien personnel, à sa toute première souscription :
              </p>
              <p className="text-primary mt-4 text-4xl font-bold">
                {data.directRatePercent}&nbsp;%
                <span className="text-muted-foreground ml-2 text-base font-normal">
                  du prix payé
                </span>
              </p>

              {data.example && (
                <div className="border-border bg-muted/40 mt-6 space-y-4 rounded-xl border p-4 text-sm">
                  <p className="text-muted-foreground">
                    Exemple : abonnement annuel à{" "}
                    <span className="text-foreground font-medium">
                      {data.example.price.toLocaleString("fr-FR")} F CFA
                    </span>
                    , soit{" "}
                    <span className="text-foreground font-medium">
                      {data.example.commission.toLocaleString("fr-FR")} F CFA
                    </span>{" "}
                    de commission par nouvel abonné parrainé.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {REFERRAL_EXAMPLES.map((count) => (
                      <div
                        key={count}
                        className="border-border bg-card flex flex-col justify-between gap-1 rounded-lg border p-3 text-center"
                      >
                        <p className="text-muted-foreground text-xs">
                          {count} abonné{count > 1 ? "s" : ""} parrainé
                          {count > 1 ? "s" : ""}
                        </p>
                        <p className="text-primary font-semibold whitespace-nowrap tabular-nums">
                          {(data.example!.commission * count).toLocaleString(
                            "fr-FR",
                          )}{" "}
                          F
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-muted-foreground mt-4 text-xs">
                Exemples donnés à titre pédagogique, calculés avec le prix et le
                taux en vigueur : ce n&apos;est pas une promesse de gains. La
                commission n&apos;est versée que sur la première souscription de
                chaque abonné réellement apporté, selon les règles du programme
                ambassadeur.
              </p>
            </div>
          </Reveal>
        )}

        <Reveal delayMs={200}>
          <p className="text-muted-foreground mx-auto mt-8 max-w-xl text-center text-sm leading-relaxed">
            Le simple fait qu&apos;une personne rejoigne Kinetix ne déclenche
            aucune commission.{" "}
            <span className="text-foreground font-medium">
              Les commissions sont déclenchées par l&apos;activité commerciale
              réelle et les souscriptions à l&apos;abonnement annuel.
            </span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
