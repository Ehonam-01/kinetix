import { Cpu, LineChart, Workflow, Zap } from "lucide-react";
import { AiMockup } from "./ai-mockup";
import { MediaSlot } from "./media-slot";
import { Reveal } from "./reveal";

const USES = [
  { icon: Zap, label: "Gagner en productivité" },
  { icon: Cpu, label: "Créer plus vite" },
  { icon: LineChart, label: "Analyser et décider" },
  { icon: Workflow, label: "Automatiser les tâches répétitives" },
];

export function AiSection() {
  return (
    <section id="ia" className="bg-muted/40 scroll-mt-16 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:px-8">
        <Reveal>
          <div>
            <span className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
              Intelligence artificielle
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              L&apos;IA change déjà le monde du travail.
            </h2>
            <p className="text-muted-foreground mt-5 text-xl leading-relaxed text-pretty">
              Sur Kinetix, l&apos;intelligence artificielle n&apos;est pas une
              option en plus : c&apos;est un axe central. Apprends à t&apos;en
              servir pour créer, analyser, automatiser et développer ton
              profil professionnel ou ton projet.
            </p>
            <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {USES.map((use) => (
                <li key={use.label} className="flex items-center gap-3">
                  <span className="bg-brand-accent/10 text-brand-accent flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <use.icon className="size-4.5" />
                  </span>
                  <span className="text-base font-medium">{use.label}</span>
                </li>
              ))}
            </ul>
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
              alt="Démonstration de l'IA utilisée sur Kinetix"
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
