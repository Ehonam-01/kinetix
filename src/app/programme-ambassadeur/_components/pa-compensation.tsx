import { ArrowRight } from "lucide-react";
import { Reveal } from "@/app/_components/reveal";
import type { CompensationData } from "../data";

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
                <div className="border-border bg-muted/40 mt-6 flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-muted-foreground">
                    Exemple : abonnement annuel à{" "}
                    <span className="text-foreground font-medium">
                      {data.example.price.toLocaleString("fr-FR")} F CFA
                    </span>
                  </span>
                  <span className="flex items-center gap-2 font-semibold">
                    <ArrowRight className="text-primary size-4" />
                    {data.example.commission.toLocaleString("fr-FR")} F CFA de
                    commission
                  </span>
                </div>
              )}
              <p className="text-muted-foreground mt-4 text-xs">
                Exemple donné à titre pédagogique. Les commissions sont soumises
                aux règles en vigueur du programme ambassadeur.
              </p>
            </div>
          </Reveal>
        )}

        {data.levels.length > 0 && (
          <Reveal delayMs={150}>
            <div className="mt-8">
              <h3 className="font-heading text-center text-lg font-semibold">
                Le système de génération
              </h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed">
                Quand ton activité de recommandation se développe, les
                souscriptions réalisées dans ton organisation génèrent du
                volume. Selon les conditions d&apos;éligibilité et le niveau
                atteint, certaines souscriptions ouvrent droit à une commission
                de génération.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.levels.map((level) => (
                  <div
                    key={level.code}
                    className="border-border bg-card rounded-xl border p-4 text-center"
                  >
                    <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {level.name}
                    </p>
                    <p className="text-primary mt-1 text-2xl font-bold">
                      {level.ratePercent}&nbsp;%
                    </p>
                  </div>
                ))}
              </div>
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
