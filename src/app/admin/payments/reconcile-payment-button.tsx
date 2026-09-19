"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reconcilePaymentAction } from "./actions";

const RESULT_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmé — compte débloqué.",
  PENDING: "Toujours en attente chez le fournisseur.",
  FAILED: "Le fournisseur indique un échec.",
};

export function ReconcilePaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const { result, error } = await reconcilePaymentAction(paymentId);
      if (error) {
        setMessage(error);
        return;
      }
      setMessage(RESULT_LABEL[result!.status] ?? result!.status);
    });
  }

  return (
    <div className="text-right">
      <Button size="sm" variant="outline" disabled={pending} onClick={handleClick}>
        {pending ? "Vérification..." : "Vérifier auprès du fournisseur"}
      </Button>
      {message && (
        <p className="text-muted-foreground mt-1 text-xs">{message}</p>
      )}
    </div>
  );
}
