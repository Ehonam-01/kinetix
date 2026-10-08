"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markOrientationRequestHandledAction } from "./actions";

export function HandledButton({ requestId }: { requestId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await markOrientationRequestHandledAction(requestId);
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? "Enregistrement..." : "Marquer comme traitée"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
