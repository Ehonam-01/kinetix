"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelScheduledPriceChangeAction,
  scheduleSubscriptionPriceChangeAction,
} from "./actions";

// "Fin du prix de lancement": the last day at the current price, and the
// price from the day after. Stored as the new price starting at midnight
// GMT the day after lastDay.
export function LaunchEndForm({
  defaultPrice,
  scheduled,
}: {
  defaultPrice: number;
  scheduled: { value: number; lastDay: string; lastDayLabel: string } | null;
}) {
  const [lastDay, setLastDay] = useState(scheduled?.lastDay ?? "");
  const [price, setPrice] = useState(String(scheduled?.value ?? defaultPrice));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!lastDay) {
      setError("Choisissez le dernier jour du prix de lancement.");
      return;
    }
    const start = new Date(`${lastDay}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 1);
    startTransition(async () => {
      const result = await scheduleSubscriptionPriceChangeAction(
        Number(price),
        start.toISOString().slice(0, 10),
      );
      if (result.error) setError(result.error);
    });
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelScheduledPriceChangeAction();
      if (result.error) setError(result.error);
      else setLastDay("");
    });
  }

  return (
    <div className="space-y-4">
      {scheduled ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
          Programmé : prix de lancement jusqu&apos;au{" "}
          <strong>{scheduled.lastDayLabel}</strong> inclus, puis{" "}
          <strong>{scheduled.value.toLocaleString("fr-FR")} F</strong>{" "}
          automatiquement. Le compte à rebours et les rappels par email sont
          actifs.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Aucune date programmée : la page d&apos;accueil annonce le prix normal
          sans compte à rebours.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="launch-last-day">Dernier jour au prix actuel</Label>
          <Input
            id="launch-last-day"
            type="date"
            value={lastDay}
            onChange={(e) => setLastDay(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="launch-new-price">Nouveau prix (F CFA)</Label>
          <Input
            id="launch-new-price"
            type="number"
            min={0}
            step={500}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Enregistrement…" : scheduled ? "Modifier" : "Programmer"}
        </Button>
        {scheduled && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={cancel}
          >
            Annuler la programmation
          </Button>
        )}
      </div>
    </div>
  );
}
