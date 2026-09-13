import { Hammer, Lightbulb, LineChart, Clock as ClockIcon } from "lucide-react";
import { Reveal } from "./reveal";

const VALUES = [
  {
    number: "01",
    icon: Hammer,
    title: "Formations pratiques",
    description:
      "Apprenez avec des contenus conçus pour être appliqués dans la vie réelle.",
  },
  {
    number: "02",
    icon: ClockIcon,
    title: "Apprentissage flexible",
    description: "Apprenez à votre rythme, où que vous soyez.",
  },
  {
    number: "03",
    icon: LineChart,
    title: "Progression suivie",
    description:
      "Suivez votre avancement et reprenez votre apprentissage là où vous vous êtes arrêté.",
  },
  {
    number: "04",
    icon: Lightbulb,
    title: "Compétences utiles",
    description:
      "Développez des compétences directement applicables à vos projets et votre activité.",
  },
];

export function ValueSection() {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Plus qu&apos;une formation. Un parcours pour progresser.
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
