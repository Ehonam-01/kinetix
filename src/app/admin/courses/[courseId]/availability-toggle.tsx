"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateCourseAvailabilityAction } from "./actions";

// Whether members can open this course now, or see it as "Disponible
// bientôt" — it stays listed on the homepage and in the catalog either way.
export function AvailabilityToggle({
  courseId,
  comingSoon,
}: {
  courseId: string;
  comingSoon: boolean;
}) {
  const [current, setCurrent] = useState(comingSoon);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: boolean) {
    if (next === current || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCourseAvailabilityAction(courseId, next);
      if (result.error) setError(result.error);
      else setCurrent(next);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={!current ? "default" : "outline"}
          disabled={pending}
          onClick={() => choose(false)}
        >
          Disponible
        </Button>
        <Button
          size="sm"
          variant={current ? "default" : "outline"}
          disabled={pending}
          onClick={() => choose(true)}
        >
          Bientôt disponible
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {current
          ? "Les membres voient « Disponible bientôt » et ne peuvent pas encore ouvrir les leçons. Vous gardez l'accès pour préparer le cours."
          : "Les membres abonnés peuvent suivre ce cours."}
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
