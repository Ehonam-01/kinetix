import { Compass, Handshake, Sprout, Telescope } from "lucide-react";
import { Reveal } from "./reveal";

const VALUES = [
  {
    number: "01",
    icon: Compass,
    title: "Un repère",
    description:
      "Un cap clair dans un monde qui change vite : on vous aide à savoir où concentrer vos efforts.",
  },
  {
    number: "02",
    icon: Handshake,
    title: "Du mentorat",
    description:
      "Apprenez auprès de personnes qui ont vécu ce que vous voulez vivre, pas seulement des vidéos.",
  },
  {
    number: "03",
    icon: Telescope,
    title: "De la découverte",
    description:
      "Explorez plusieurs domaines, testez vos talents et trouvez ce qui vous anime vraiment.",
  },
  {
    number: "04",
    icon: Sprout,
    title: "L'éclosion de talents",
    description:
      "Des formations pratiques pensées pour transformer vos idées en compétences, et vos compétences en opportunités.",
  },
];

export function ValueSection() {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Plus qu&apos;une plateforme de formation. Un repère pour grandir.
          </h2>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value, i) => (
            <Reveal key={value.title} delayMs={i * 80}>
              <div className="border-border bg-card h-full rounded-2xl border p-6">
                <div className="flex items-center justify-between">
                  <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                    <value.icon className="size-5" />
                  </div>
                  <span className="text-muted-foreground/50 text-sm font-semibold">
                    {value.number}
                  </span>
                </div>
                <h3 className="font-heading mt-4 font-semibold">
                  {value.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {value.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
