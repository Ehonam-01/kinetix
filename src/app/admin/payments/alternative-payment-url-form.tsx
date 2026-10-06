"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAlternativePaymentUrlAction } from "./actions";

export function AlternativePaymentUrlForm({
  current,
}: {
  current: string | null;
}) {
  const [value, setValue] = useState(current ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await updateAlternativePaymentUrlAction(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue(result.url ?? "");
      setSaved(
        result.url
          ? "Lien enregistré."
          : "Lien retiré : il n'est plus proposé aux membres.",
      );
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border p-4">
      <label htmlFor="alternative-payment-url" className="text-sm font-medium">
        Lien de paiement alternatif
      </label>
      <p className="text-muted-foreground text-xs">
        Proposé aux membres qui ne trouvent pas leur moyen de paiement (par
        exemple votre boutique Maketou). Le paiement n&apos;arrive pas
        automatiquement sur le site : une fois la preuve reçue, activez le
        compte depuis la fiche du membre (« Accorder un abonnement »). Laissez
        vide pour ne rien proposer.
      </p>
      <div className="flex gap-2 pt-1">
        <Input
          id="alternative-payment-url"
          inputMode="url"
          placeholder="https://…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(null);
          }}
        />
        <Button size="sm" disabled={pending} onClick={handleSave}>
          {pending ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">{saved}</p>}
    </div>
  );
}
