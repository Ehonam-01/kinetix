import Link from "next/link";
import { ArrowRight, Code2, LineChart, PenLine, Workflow } from "lucide-react";
import { AiMockup } from "./ai-mockup";
import { MediaSlot } from "./media-slot";
import { Reveal } from "./reveal";

const USES = [
  { icon: PenLine, label: "Créer du contenu avec l'IA" },
  { icon: Code2, label: "Créer une application sans coder" },
  { icon: LineChart, label: "Analyser et décider plus vite" },
  { icon: Workflow, label: "Automatiser les tâches répétitives" },
];

export function AiSection() {
  return (
    <section
      id="ia"
      className="bg-muted/40 scroll-mt-16 overflow-x-hidden py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <Reveal>
          <div>
            <span className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
              Formations en intelligence artificielle
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              L&apos;IA, au cœur de nos formations.
            </h2>
            <p className="text-muted-foreground mt-5 text-xl leading-relaxed text-pretty">
              L&apos;IA change déjà le monde du travail, et c&apos;est le cœur
              du catalogue Kinetix. Des formations concrètes, pas à pas, pour
              apprendre à utiliser les outils d&apos;IA et en faire un vrai
              levier pour ton activité, ton projet ou ton profil professionnel.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {USES.map((use) => (
                <li
                  key={use.label}
                  className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left"
                >
                  <span className="bg-brand-accent/10 text-brand-accent flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <use.icon className="size-4.5" />
                  </span>
                  <span className="text-base font-medium">{use.label}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/formations"
              className="text-brand-accent mt-8 inline-flex items-center gap-1.5 text-base font-semibold hover:underline"
            >
              Voir les formations
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>

        <Reveal delayMs={150}>
          <div className="relative">
            <div
              aria-hidden="true"
              className="bg-brand-accent/20 absolute -inset-8 -z-10 rounded-full blur-3xl"
            />
            <MediaSlot
              src="/ai-demo.png"
              alt="Exemple d'exercice d'une formation IA Kinetix"
              brief="Vraie capture d'écran ou démo produit — pas d'illustration de robot. En attendant, l'aperçu ci-dessous reste affiché."
              className="mx-auto max-w-lg lg:max-w-none"
              placeholder={<AiMockup />}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
