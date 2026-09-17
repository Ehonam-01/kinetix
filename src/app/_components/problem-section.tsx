import { Brain, MapPinned, Users } from "lucide-react";
import { Reveal } from "./reveal";

const REASONS = [
  {
    icon: MapPinned,
    title: "Pas de direction claire",
    description:
      "Trop de choix, pas assez de repères pour savoir où concentrer ses efforts.",
  },
  {
    icon: Brain,
    title: "L'IA rebat déjà les cartes",
    description:
      "Les compétences qui suffisaient hier ne suffisent plus — et ça va plus vite qu'on ne le pense.",
  },
  {
    icon: Users,
    title: "Seul, on avance moins vite",
    description:
      "Pas de mentor, pas de réseau, pas de retour sur ses idées ou ses projets.",
  },
];

// The argument the rest of the page builds on — placed right after the
// hero, before the offer even shows up: the case for *why this is hard*
// comes before the *what we offer* (value-section.tsx) and the *proof*
// (featured-courses.tsx), same structure as any real sales page.
export function ProblemSection() {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-primary text-xs font-semibold tracking-widest uppercase">
              Le vrai défi
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Tu as l&apos;ambition. Mais as-tu le chemin ?
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Ne pas savoir quelle compétence apprendre. Ne pas savoir par où
              commencer. Avoir une idée, sans réseau pour la faire avancer. Ce
              n&apos;est pas un manque d&apos;ambition — c&apos;est un manque de
              chemin.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {REASONS.map((reason, i) => (
            <Reveal key={reason.title} delayMs={i * 100}>
              <div className="border-border bg-card h-full rounded-2xl border p-6">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                  <reason.icon className="size-5" />
                </div>
                <h3 className="font-heading mt-4 font-semibold">
                  {reason.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delayMs={300}>
          <p className="mt-10 text-center text-lg font-semibold text-balance">
            C&apos;est exactement pour ça que Kinetix Africa existe.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
