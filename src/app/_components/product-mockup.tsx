import { Award, CheckCircle2, PlayCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// A hand-built illustration of the learning space — not a screenshot of
// the real dashboard, just evocative of it: progress bar, mini stats, a
// lesson checklist. Placeholder numbers, same as any SaaS hero mockup —
// not a claim about real usage. Shared between the homepage hero and the
// auth split-screen panel so both read as the same brand.
export function ProductMockup() {
  return (
    <div className="relative mx-auto max-w-md lg:max-w-none">
      <div className="border-border bg-card rounded-2xl border p-5 shadow-2xl">
        <div className="flex items-center gap-1.5 pb-4">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Marketing digital pour entrepreneurs
          </p>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div className="bg-primary h-full w-2/3 rounded-full" />
          </div>
          <p className="text-muted-foreground text-xs">
            8 / 12 leçons terminées
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="border-border rounded-xl border p-3">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <PlayCircle className="size-4" />
            </div>
            <p className="mt-2 text-lg font-semibold">6</p>
            <p className="text-muted-foreground text-xs">Formations suivies</p>
          </div>
          <div className="border-border rounded-xl border p-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-4" />
            </div>
            <p className="mt-2 text-lg font-semibold">92%</p>
            <p className="text-muted-foreground text-xs">Progression moyenne</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {[
            "Les bases du marketing digital",
            "Créer une offre irrésistible",
            "Lancer sa première campagne",
          ].map((item, i) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <CheckCircle2
                className={cn(
                  "size-4 shrink-0",
                  i < 2 ? "text-emerald-500" : "text-muted-foreground/40",
                )}
              />
              <span className={i < 2 ? "" : "text-muted-foreground"}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* A normal-flow sibling pulled up by -mt, not absolutely positioned
          over the card — keeps the overlap to a precise, small sliver of
          the card's own bottom padding instead of risking it creeping over
          the checklist text above (which sm:flex + hidden already keeps
          out of the way below sm anyway). */}
      <div className="border-border bg-card relative z-10 -mt-4 ml-6 hidden w-fit items-center gap-3 rounded-xl border p-3 shadow-xl sm:flex">
        <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Award className="size-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Certificat obtenu</p>
          <p className="text-muted-foreground text-xs">Marketing digital</p>
        </div>
      </div>
    </div>
  );
}
