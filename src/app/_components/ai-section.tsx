import { Cpu, LineChart, Workflow, Zap } from "lucide-react";
import { Reveal } from "./reveal";
import { AiMockup } from "./ai-mockup";

const USES = [
  { icon: Zap, label: "Gagner en productivité" },
  { icon: Cpu, label: "Créer plus vite" },
  { icon: LineChart, label: "Analyser et décider" },
  { icon: Workflow, label: "Automatiser les tâches répétitives" },
];

export function AiSection() {
  return (
    <section id="ia" className="bg-muted/40 scroll-mt-16 py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Reveal>
          <div>
            <span className="text-primary text-xs font-semibold tracking-widest uppercase">
              Intelligence artificielle
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              L&apos;IA change déjà le monde du travail. Apprends à travailler
              avec elle.
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Sur Kinetix, l&apos;intelligence artificielle n&apos;est pas une
              option en plus : c&apos;est un axe central. Apprends à t&apos;en
              servir pour créer, analyser, automatiser et développer ton profil
              professionnel ou ton projet.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3">
              {USES.map((use) => (
                <li
                  key={use.label}
                  className="border-border bg-card flex items-center gap-2.5 rounded-xl border p-3"
                >
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                    <use.icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{use.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delayMs={150}>
          <AiMockup />
        </Reveal>
      </div>
    </section>
  );
}
