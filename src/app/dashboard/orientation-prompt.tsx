import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// On the overview, for a member who stated a goal (homepage "Que veux-tu
// accomplir ?", or Paramètres) and hasn't sent the orientation
// questionnaire yet: the next step, mentors or the questionnaire.
export function OrientationPrompt({ goal }: { goal: string }) {
  const unsure = goal === "Je ne sais pas encore";
  return (
    <div className="border-brand-accent/30 bg-brand-accent/10 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="bg-brand-accent text-brand-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Compass className="size-5" />
        </div>
        <div>
          <p className="font-semibold">
            {unsure
              ? "Trouvons ta direction ensemble"
              : `Ton objectif : ${goal}`}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Un mentor peut t&apos;accompagner, et l&apos;équipe peut te
            conseiller après un court questionnaire.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/mentors"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Voir les mentors
        </Link>
        <Link
          href="/dashboard/mentors/orientation"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Questionnaire d&apos;orientation
        </Link>
      </div>
    </div>
  );
}
