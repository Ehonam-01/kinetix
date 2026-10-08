import {
  Briefcase,
  Compass,
  Globe,
  Handshake,
  HelpCircle,
  Lightbulb,
  Network,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { GOAL_OPTIONS, type GoalValue } from "@/config/goals";
import { Reveal } from "./reveal";

const GOAL_DETAILS: Record<
  GoalValue,
  { icon: LucideIcon; description: string }
> = {
  emploi: {
    icon: Briefcase,
    description:
      "Développe les compétences et le profil qui font la différence.",
  },
  entreprendre: {
    icon: Rocket,
    description: "Passe de l'idée à un projet concret.",
  },
  ia: {
    icon: Sparkles,
    description:
      "Apprends à utiliser l'intelligence artificielle dans ton travail.",
  },
  competence: {
    icon: Lightbulb,
    description: "Apprends une compétence pratique et valorisable.",
  },
  freelance: {
    icon: Globe,
    description: "Construis un profil capable de travailler avec des clients.",
  },
  projet: {
    icon: Compass,
    description: "Trouve les compétences et les ressources pour avancer.",
  },
  mentor: {
    icon: Handshake,
    description: "Apprends auprès de quelqu'un qui a déjà fait le chemin.",
  },
  reseau: {
    icon: Network,
    description: "Rencontre d'autres jeunes ambitieux et élargis ton cercle.",
  },
  incertain: {
    icon: HelpCircle,
    description: "Aide-moi à trouver ma direction.",
  },
};

// app/orientation/route.ts: sign-up first for a visitor (the goal is
// remembered), the mentors page — or the orientation questionnaire for
// "Je ne sais pas encore" — for a member.
const orientationHref = (goal: GoalValue) => `/orientation?objectif=${goal}`;

const GOALS = GOAL_OPTIONS.map((goal) => ({
  title: goal.label,
  href: orientationHref(goal.value),
  ...GOAL_DETAILS[goal.value],
}));

// Every card goes through /orientation: becoming a member comes first,
// then the member is guided towards a mentor or the team's orientation
// questionnaire. Plain <a>, not next/link: that route saves the goal, so it
// must never be prefetched.
//
// "incertain" gets its own accent-tinted treatment (not just another grid
// cell) — it's the one path aimed at someone who can't yet name a goal,
// which is central to how Kinetix wants to be found, not an edge case to
// bury at the end of a row.
export function GoalSection() {
  return (
    <section className="bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Que veux-tu accomplir ?
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              Choisis ta direction. On s&apos;occupe du chemin.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {GOALS.filter((goal) => goal.title !== "Je ne sais pas encore").map(
              (goal) => (
                <a
                  key={goal.title}
                  href={goal.href}
                  className="border-border bg-card hover:border-brand-accent/50 hover:bg-brand-accent/5 group flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-colors sm:items-start sm:p-6 sm:text-left"
                >
                  <div className="bg-brand-accent/10 text-brand-accent group-hover:bg-brand-accent group-hover:text-brand-accent-foreground flex size-10 items-center justify-center rounded-xl transition-colors">
                    <goal.icon className="size-5" />
                  </div>
                  <p className="mt-1 text-base font-semibold">{goal.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {goal.description}
                  </p>
                </a>
              ),
            )}
          </div>
        </Reveal>

        <Reveal delayMs={180}>
          <a
            href={orientationHref("incertain")}
            className="border-brand-accent/30 bg-brand-accent/10 hover:bg-brand-accent/15 mt-6 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center transition-colors sm:flex-row sm:text-left"
          >
            <div className="bg-brand-accent text-brand-accent-foreground flex size-12 shrink-0 items-center justify-center rounded-xl">
              <HelpCircle className="size-6" />
            </div>
            <div>
              <p className="text-lg font-semibold">Je ne sais pas encore</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                C&apos;est normal, et c&apos;est même pour ça que Kinetix existe
                — aide-moi à trouver ma direction.
              </p>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
