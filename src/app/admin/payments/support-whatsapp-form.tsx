"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateSupportWhatsappAction } from "./actions";

export function SupportWhatsappForm({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ? `+${current}` : "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await updateSupportWhatsappAction(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue(result.number ? `+${result.number}` : "");
      setSaved(
        result.number
          ? "Numéro enregistré."
          : "Numéro retiré : le lien n'est plus affiché aux membres.",
      );
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border p-4">
      <label htmlFor="support-whatsapp" className="text-sm font-medium">
        WhatsApp du support
      </label>
      <p className="text-muted-foreground text-xs">
        Proposé aux membres dont le pays n&apos;apparaît pas dans la liste des
        paiements ou des retraits. Numéro international avec l&apos;indicatif,
        par exemple +228 90 00 00 00. Laissez vide pour ne rien afficher.
      </p>
      <div className="flex max-w-md gap-2 pt-1">
        <Input
          id="support-whatsapp"
          inputMode="tel"
          placeholder="+228 90 00 00 00"
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
