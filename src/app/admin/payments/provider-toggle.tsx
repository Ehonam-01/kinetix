"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updatePaymentProviderAction } from "./actions";

const PROVIDERS = [
  { value: "MONEROO", label: "Moneroo" },
  { value: "BICTORYS", label: "Bictorys" },
] as const;

export function ProviderToggle({
  activeProvider,
}: {
  activeProvider: string;
}) {
  const [current, setCurrent] = useState(activeProvider);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSelect(provider: (typeof PROVIDERS)[number]["value"]) {
    if (provider === current || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updatePaymentProviderAction(provider);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCurrent(provider);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border p-4">
      <p className="text-sm font-medium">Fournisseur de paiement actif</p>
      <p className="text-muted-foreground text-xs">
        S&apos;applique aux nouveaux paiements (inscription, abonnement). Les
        retraits automatisés passent toujours par Bictorys, quel que soit ce
        choix.
      </p>
      <div className="flex gap-2 pt-1">
        {PROVIDERS.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={current === p.value ? "default" : "outline"}
            disabled={pending}
            onClick={() => handleSelect(p.value)}
            className={cn(current === p.value && "pointer-events-none")}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
