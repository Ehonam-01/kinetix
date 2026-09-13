import { Reveal } from "@/app/_components/reveal";

const LEVELS = ["Bronze", "Argent", "Or", "Platine", "Diamant"];

const MARKERS = [
  "Compétences développées",
  "Activité réelle",
  "Volume commercial",
  "Accompagnement d'autres membres",
  "Contribution à la communauté",
];

export function PaProgression() {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Un parcours de progression, pas une course au recrutement.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Les niveaux Kinetix marquent ta progression dans ton activité
              d&apos;ambassadeur — pas seulement combien de personnes tu as
              inscrites.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {LEVELS.map((level, i) => (
              <div key={level} className="flex items-center gap-2 sm:gap-3">
                <span className="border-border bg-card rounded-full border px-4 py-2 text-sm font-semibold sm:px-5 sm:text-base">
                  {level}
                </span>
                {i < LEVELS.length - 1 && (
                  <span className="text-muted-foreground/50" aria-hidden="true">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delayMs={150}>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
            {MARKERS.map((marker) => (
              <div
                key={marker}
                className="text-muted-foreground flex items-center gap-2 text-sm"
              >
                <span
                  className="bg-primary size-1.5 shrink-0 rounded-full"
                  aria-hidden="true"
                />
                {marker}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
