"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { subscribeAction } from "./actions";

// Moneroo is hosted-checkout only — no operator/country/phone to collect,
// unlike the Bictorys/PayDunya direct-softpay forms. subscribeAction
// ignores those three params for this provider, so empty strings are safe
// to pass through.
export function MonerooSubscribeButton({ price }: { price: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      // On success this never resolves normally — subscribeAction
      // redirects server-side to Moneroo's checkout page.
      const result = await subscribeAction("", "", "");
      if (result.error) setError(result.error);
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
