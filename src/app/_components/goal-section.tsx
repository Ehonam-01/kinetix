import Link from "next/link";
import {
  Briefcase,
  Compass,
  Globe,
  HelpCircle,
  Lightbulb,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { GOAL_OPTIONS, type GoalValue } from "@/config/goals";
import { Reveal } from "./reveal";

const GOAL_DETAILS: Record<
  GoalValue,
  { icon: LucideIcon; description: string; href: string }
> = {
  emploi: {
    icon: Briefcase,
    description:
      "Développe les compétences et le profil qui font la différence.",
    href: "#formations",
  },
  entreprendre: {
    icon: Rocket,
    description: "Passe de l'idée à un projet concret.",
    href: "#formations",
  },
  ia: {
    icon: Sparkles,
    description:
      "Apprends à utiliser l'intelligence artificielle dans ton travail.",
    href: "#formations",
  },
  competence: {
    icon: Lightbulb,
    description: "Apprends une compétence pratique et valorisable.",
    href: "#formations",
  },
  freelance: {
    icon: Globe,
    description: "Construis un profil capable de travailler avec des clients.",
    href: "#formations",
  },
  projet: {
    icon: Compass,
    description: "Trouve les compétences et les ressources pour avancer.",
    href: "#formations",
  },
  incertain: {
    icon: HelpCircle,
    description: "Aide-moi à trouver ma direction.",
    href: "/register",
  },
};

const GOALS = GOAL_OPTIONS.map((goal) => ({
  title: goal.label,
  ...GOAL_DETAILS[goal.value],
}));

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
