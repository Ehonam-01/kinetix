import { BookOpen, Handshake, Rocket, Users } from "lucide-react";
import { Reveal } from "./reveal";

const PILLARS = [
  {
    icon: BookOpen,
    title: "Apprendre",
    description:
      "Des formations pratiques, pensées pour être appliquées tout de suite — pas seulement regardées.",
  },
  {
    icon: Handshake,
    title: "Être accompagné",
    description:
      "Des mentors qui ont vécu ce que tu veux vivre, pour ne jamais avancer à l'aveugle.",
  },
  {
    icon: Users,
    title: "Rencontrer",
    description:
      "Une communauté de jeunes ambitieux à qui parler, avec qui construire, sur qui compter.",
  },
  {
    icon: Rocket,
    title: "Construire",
    description:
      "Transforme tes compétences en projets concrets, et tes projets en opportunités.",
  },
];

// Four pillars, deliberately presented as a big editorial 2x2 rather than a
// tight 4-up card row — the previous version (small icon + "01"/"02" corner
// numbers, tight padding) was the single clearest instance of the
// "dashboard feature grid" look this pass moves away from.
export function ValueSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Plus qu&apos;une plateforme de formation.{" "}
            <span className="text-brand-accent">Un espace pour grandir.</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-12 gap-y-14 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delayMs={i * 80}>
              <div className="flex items-start gap-5">
                <div className="bg-brand-accent/10 text-brand-accent flex size-14 shrink-0 items-center justify-center rounded-2xl">
                  <pillar.icon className="size-7" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                    {pillar.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-base leading-relaxed sm:text-lg">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
