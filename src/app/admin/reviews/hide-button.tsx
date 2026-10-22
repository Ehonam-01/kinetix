"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setCourseReviewHiddenAction } from "./actions";

export function ReviewVisibilityButton({
  reviewId,
  hidden,
}: {
  reviewId: string;
  hidden: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant={hidden ? "outline" : "ghost"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setCourseReviewHiddenAction(reviewId, !hidden);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "…" : hidden ? "Réafficher" : "Masquer"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
