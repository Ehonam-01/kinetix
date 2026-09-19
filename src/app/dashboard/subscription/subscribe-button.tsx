"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { subscribeAction } from "./actions";

export function SubscribeButton({ price }: { price: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      // On success this never resolves normally — subscribeAction redirects
      // server-side. Only an {error} return means it failed.
      const result = await subscribeAction();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <Button disabled={pending} onClick={handleClick} className="w-full">
        {pending
          ? "Redirection vers le paiement..."
          : `Payer — ${price.toLocaleString("fr-FR")} F`}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
