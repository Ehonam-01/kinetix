import { Brain, MapPinned, Users } from "lucide-react";
import { Reveal } from "./reveal";

const REASONS = [
  {
    icon: Brain,
    title: "L'IA change les règles",
    description:
      "Les compétences qui suffisaient hier ne suffisent plus. Ce qui compte désormais, c'est la capacité à apprendre vite, et à apprendre juste.",
  },
  {
    icon: Users,
    title: "Seul, on avance moins vite",
    description:
      "Un mentor et une communauté qui pousse dans la même direction valent souvent plus qu'une formation suivie isolément.",
  },
  {
    icon: MapPinned,
    title: "La clarté fait la différence",
    description:
      "Savoir où concentrer ses efforts, dans un monde qui change de toutes parts, c'est déjà la moitié du chemin parcouru.",
  },
];

// The argument the rest of the page builds on — deliberately placed right
// after the hero, before the catalog even shows up: the case for *why this
// matters now* comes before the *what we offer* (value-section.tsx) and the
// *proof* (featured-courses.tsx), same structure as any real sales page.
export function WhyNowSection() {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-primary text-xs font-semibold tracking-widest uppercase">
              Pourquoi maintenant
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Le changement ne va pas vous attendre.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              L&apos;intelligence artificielle et les nouvelles technologies
              redessinent déjà les métiers et les compétences recherchées. Ceux
              qui s&apos;y préparent aujourd&apos;hui prennent une avance que
              les autres ne rattrapent pas.
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
