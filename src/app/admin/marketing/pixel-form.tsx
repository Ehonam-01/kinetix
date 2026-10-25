"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateMetaPixelAction } from "./actions";

export function PixelForm({ current }: { current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateMetaPixelAction(value);
      setMessage(
        result.error
          ? { ok: false, text: result.error }
          : {
              ok: true,
              text: value.trim()
                ? "Pixel enregistré : actif sur le site d'ici 5 minutes."
                : "Pixel retiré du site.",
            },
      );
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex. 1234567890123456"
          inputMode="numeric"
          className="max-w-xs"
          aria-label="Identifiant du pixel Meta"
        />
        <Button size="sm" disabled={pending} onClick={save} className="h-9">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
      {message && (
        <p
          className={
            message.ok ? "text-sm text-green-600" : "text-destructive text-sm"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
