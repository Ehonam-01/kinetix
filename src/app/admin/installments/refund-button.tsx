"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markInstallmentRefundedAction } from "./actions";

// Two steps, so a stray click can't record a refund that wasn't sent.
export function RefundButton({
  planId,
  amount,
}: {
  planId: string;
  amount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
        Marquer comme remboursé
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs">
        Confirmez que les {amount.toLocaleString("fr-FR")} F ont bien été
        envoyés.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await markInstallmentRefundedAction(planId);
              if (result.error) setError(result.error);
            })
          }
        >
          {pending ? "Enregistrement..." : "Oui, remboursé"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
