"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { checkWithdrawalPayoutAction } from "./actions";

export function CheckPayoutButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await checkWithdrawalPayoutAction(requestId);
            setMessage(result.message);
          })
        }
      >
        {pending ? "Vérification..." : "Vérifier le statut"}
      </Button>
      {message && <p className="text-muted-foreground text-xs">{message}</p>}
    </div>
  );
}
