import Link from "next/link";
import { Compass, Rocket, Sprout, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

const STEPS = [
  {
    number: "01",
    icon: Compass,
    title: "Oriente-toi",
    description:
      "Dis-nous ce que tu veux accomplir, on t'aide à trouver ta direction.",
  },
  {
    number: "02",
    icon: Rocket,
    title: "Apprends",
    description:
      "Accède immédiatement aux formations qui correspondent à ton objectif.",
  },
  {
    number: "03",
    icon: Users,
    title: "Rencontre",
    description:
      "Échange avec la communauté et trouve les bonnes personnes pour avancer.",
  },
  {
    number: "04",
    icon: Sprout,
    title: "Avance",
    description:
      "Transforme tes nouvelles compétences en projets et en opportunités.",
  },
];

export function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Commencer est simple.
          </h2>
        </Reveal>

        <div className="relative mt-16 grid grid-cols-1 gap-10 sm:grid-cols-4 sm:gap-6">
          <div
            aria-hidden="true"
            className="border-border absolute top-8 right-0 left-0 hidden border-t border-dashed sm:block"
          />
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delayMs={i * 100}>
              <div className="relative flex flex-col items-center text-center">
                <div className="bg-brand-accent text-brand-accent-foreground border-background relative z-10 flex size-16 items-center justify-center rounded-2xl border-4 shadow-sm">
                  <step.icon className="size-7" />
                </div>
                <span className="text-muted-foreground/60 mt-4 text-xs font-semibold tracking-wide">
                  ÉTAPE {step.number}
                </span>
                <h3 className="font-heading mt-1 text-lg font-semibold">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-12 px-6 text-base",
            )}
          >
            Commencer maintenant
          </Link>
        </div>
      </div>
    </section>
  );
}
