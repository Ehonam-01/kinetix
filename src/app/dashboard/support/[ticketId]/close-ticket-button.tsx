"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { closeTicketAction } from "../actions";

export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const router = useRouter();
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
            const result = await closeTicketAction(ticketId);
            if (result.error) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Fermeture…" : "Mon problème est résolu"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
