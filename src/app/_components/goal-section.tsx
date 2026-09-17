import Link from "next/link";
import {
  Briefcase,
  Compass,
  Globe,
  HelpCircle,
  Lightbulb,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Reveal } from "./reveal";

const GOALS = [
  {
    icon: Briefcase,
    title: "Trouver un emploi",
    description:
      "Développe les compétences et le profil qui font la différence.",
    href: "#formations",
  },
  {
    icon: Rocket,
    title: "Entreprendre",
    description: "Passe de l'idée à un projet concret.",
    href: "#formations",
  },
  {
    icon: Sparkles,
    title: "Maîtriser l'IA",
    description:
      "Apprends à utiliser l'intelligence artificielle dans ton travail.",
    href: "#formations",
  },
  {
    icon: Lightbulb,
    title: "Développer une compétence",
    description: "Apprends une compétence pratique et valorisable.",
    href: "#formations",
  },
  {
    icon: Globe,
    title: "Devenir freelance",
    description: "Construis un profil capable de travailler avec des clients.",
    href: "#formations",
  },
  {
    icon: Compass,
    title: "Développer mon projet",
    description: "Trouve les compétences et les ressources pour avancer.",
    href: "#formations",
  },
  {
    icon: HelpCircle,
    title: "Je ne sais pas encore",
    description: "Aide-moi à trouver ma direction.",
    href: "/register",
  },
];

// No segmentation engine exists yet behind this — every card is a real,
// working link (mostly #formations, see the "why" below), never a dead
// end. The point right now is the question itself: it reframes the page
// around the visitor's goal before showing a catalog, same principle a
// real quiz would serve later without this section needing to change
// shape when that backend exists.
export function GoalSection() {
  return (
    <section className="bg-muted/40 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Que veux-tu accomplir ?
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Choisis ta direction. On s&apos;occupe du chemin.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GOALS.map((goal) => (
              <Link
                key={goal.title}
                href={goal.href}
                className="border-border bg-card hover:border-primary/40 hover:bg-primary/5 group flex flex-col items-start gap-2 rounded-2xl border p-4 transition-colors sm:p-5"
              >
                <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex size-9 items-center justify-center rounded-lg transition-colors">
                  <goal.icon className="size-4.5" />
                </div>
                <p className="mt-1 text-sm font-semibold">{goal.title}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {goal.description}
                </p>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
