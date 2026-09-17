import { MediaSlot } from "./media-slot";
import { Reveal } from "./reveal";

const REASONS = [
  {
    number: "01",
    title: "Pas de direction claire",
    description:
      "Trop de choix, pas assez de repères pour savoir où concentrer ses efforts.",
  },
  {
    number: "02",
    title: "L'IA rebat déjà les cartes",
    description:
      "Les compétences qui suffisaient hier ne suffisent plus — et ça va plus vite qu'on ne le pense.",
  },
  {
    number: "03",
    title: "Seul, on avance moins vite",
    description:
      "Pas de mentor, pas de réseau, pas de retour sur ses idées ou ses projets.",
  },
];

// The argument the rest of the page builds on — placed right after the
// hero, before the offer even shows up: the case for *why this is hard*
// comes before the *what we offer* (value-section.tsx) and the *proof*
// (featured-courses.tsx), same structure as any real sales page.
//
// Deliberately not a card grid (title → small text → 3 icon cards): a big
// editorial statement plus a numbered list reads as a magazine argument,
// not a dashboard feature comparison — see AGENTS-brief "trop de petites
// cartes" note this section was rewritten against.
export function ProblemSection() {
  return (
    <section className="bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
              Le vrai défi
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Tu as l&apos;ambition. Mais as-tu le chemin ?
            </h2>
            <p className="text-muted-foreground mt-5 max-w-lg text-xl leading-relaxed text-pretty">
              Beaucoup de personnes veulent progresser, mais ne savent pas
              toujours par où commencer — et avancent seules.
            </p>
          </Reveal>

          <Reveal delayMs={100}>
            <MediaSlot
              src="/problem-photo.jpg"
              alt="Jeune en train d'apprendre ou de réfléchir à son parcours"
              brief="Photo humaine, naturelle : quelqu'un qui réfléchit, hésite ou travaille seul — l'émotion de ne pas encore avoir de chemin clair."
              className="aspect-4/3 w-full rounded-3xl"
            />
          </Reveal>
        </div>

        <div className="border-border mt-16 divide-y border-t">
          {REASONS.map((reason, i) => (
            <Reveal key={reason.title} delayMs={i * 100}>
              <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-2 py-8 sm:grid-cols-[5rem_1fr_2fr] sm:gap-x-10">
                <span className="text-muted-foreground/40 font-heading text-3xl font-semibold sm:text-4xl">
                  {reason.number}
                </span>
                <h3 className="font-heading col-start-2 text-xl font-semibold sm:col-start-2 sm:text-2xl">
                  {reason.title}
                </h3>
                <p className="text-muted-foreground col-span-2 text-base leading-relaxed sm:col-span-1 sm:col-start-3">
                  {reason.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={300}>
          <p className="border-border mt-4 border-t pt-10 text-2xl font-semibold text-balance sm:text-3xl">
            C&apos;est exactement pour ça que{" "}
            <span className="text-brand-accent">Kinetix Africa</span> existe.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
