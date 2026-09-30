"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { moderateLessonPostAction } from "./actions";

const LABEL = {
  hide: "Masquer",
  restore: "Rétablir",
  dismiss: "Classer le signalement",
} as const;

export function ModerationButtons({
  postId,
  decisions,
}: {
  postId: string;
  decisions: (keyof typeof LABEL)[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {decisions.map((d) => (
        <Button
          key={d}
          size="xs"
          variant={d === "hide" ? "destructive" : "outline"}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await moderateLessonPostAction(postId, d);
              if (result.error) setError(result.error);
            })
          }
        >
          {LABEL[d]}
        </Button>
      ))}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
