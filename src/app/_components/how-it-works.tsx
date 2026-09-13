import Link from "next/link";
import { Compass, Rocket, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

const STEPS = [
  {
    number: "01",
    icon: Compass,
    title: "Choisissez",
    description:
      "Explorez notre catalogue et choisissez la formation qui correspond à vos objectifs.",
  },
  {
    number: "02",
    icon: Rocket,
    title: "Apprenez",
    description:
      "Accédez immédiatement à votre formation et progressez à votre rythme.",
  },
  {
    number: "03",
    icon: Sprout,
    title: "Évoluez",
    description:
      "Transformez vos nouvelles connaissances en compétences et en opportunités.",
  },
];

export function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Comment ça marche
          </h2>
        </Reveal>

        <div className="relative mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          <div
            aria-hidden="true"
            className="border-border absolute top-8 right-0 left-0 hidden border-t border-dashed sm:block"
          />
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delayMs={i * 100}>
              <div className="relative flex flex-col items-center text-center">
                <div className="bg-primary text-primary-foreground border-background relative z-10 flex size-16 items-center justify-center rounded-2xl border-4 shadow-sm">
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
              "h-12 px-6 text-base",
            )}
          >
            Commencer à apprendre
          </Link>
        </div>
      </div>
    </section>
  );
}
