"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateSaspayEnabledAction } from "./actions";

export function SaspayToggle({
  enabled,
  configured,
}: {
  enabled: boolean;
  // SASPAY_SECRET_KEY set on the server: without it the option can't be
  // shown to members, whatever this switch says.
  configured: boolean;
}) {
  const [current, setCurrent] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSelect(next: boolean) {
    if (next === current || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateSaspayEnabledAction(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setCurrent(next);
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border p-4">
      <p className="text-sm font-medium">SasPay — autres pays et carte</p>
      <p className="text-muted-foreground text-xs">
        Ajoute « Autre pays / carte bancaire » au formulaire de paiement, à côté
        du fournisseur actif. PayDunya et le lien de paiement alternatif restent
        proposés dans tous les cas.
      </p>
      <div className="flex gap-2 pt-1">
        {[
          { value: true, label: "Activé" },
          { value: false, label: "Désactivé" },
        ].map((option) => (
          <Button
            key={option.label}
            size="sm"
            variant={current === option.value ? "default" : "outline"}
            disabled={pending}
            onClick={() => handleSelect(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {current && !configured && (
        <p className="text-xs text-amber-600">
          La clé SasPay (SASPAY_SECRET_KEY) n&apos;est pas configurée sur le
          serveur : l&apos;option n&apos;est pas affichée aux membres.
        </p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
