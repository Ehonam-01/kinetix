"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prorateCommission } from "@/lib/prorate-commission";
import { grantSubscriptionCreditAction } from "./actions";

const fmt = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;

// Validates a first subscription for what the member really has, whatever
// the price in force (services/subscriptions/grant-subscription-credit.ts).
// The split below only previews the service's, which remains the one that
// counts.
export function ValidateSubscriptionForm({
  userId,
  preview,
}: {
  userId: string;
  preview: {
    price: number;
    deposits: number;
    balance: number;
    hasSponsor: boolean;
    fullCommission: number;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [outsideText, setOutsideText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { price, deposits, balance, hasSponsor, fullCommission } = preview;
  const parsed = Number(outsideText || 0);
  const validOutside = Number.isInteger(parsed) && parsed >= 0;
  const outside = validOutside ? parsed : 0;
  const fromBalance = Math.min(
    balance,
    Math.max(0, price - deposits - outside),
  );
  const amount = deposits + outside + fromBalance;
  const commission = prorateCommission(fullCommission, amount, price);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const lines = [
      `Valider cette inscription pour ${fmt(amount)} (prix en vigueur : ${fmt(price)}) ?`,
      deposits > 0 ? `La cagnotte de ${fmt(deposits)} sera utilisée.` : null,
      fromBalance > 0
        ? `${fmt(fromBalance)} seront débités du solde du membre.`
        : null,
      hasSponsor
        ? `Commission directe du parrain : ${fmt(commission)}.`
        : "Aucun parrain : pas de commission directe.",
    ];
    if (!window.confirm(lines.filter(Boolean).join("\n\n"))) return;
    setError(null);
    startTransition(async () => {
      const result = await grantSubscriptionCreditAction(userId, outside);
      if (result.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="font-medium">Valider l&apos;inscription</p>
        <p className="text-muted-foreground text-sm">
          Prix en vigueur : {fmt(price)}. La commission directe suit le montant
          réellement disponible.
        </p>
      </div>

      <dl className="grid gap-1 text-sm sm:max-w-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Cagnotte</dt>
          <dd>{fmt(deposits)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">
            Solde utilisé (sur {fmt(balance)})
          </dt>
          <dd>{fmt(fromBalance)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Reçu hors du site</dt>
          <dd>{fmt(outside)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-1 font-medium">
          <dt>Montant validé</dt>
          <dd>{fmt(amount)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <dt>Commission du parrain</dt>
          <dd>{hasSponsor ? fmt(commission) : "Aucun parrain"}</dd>
        </div>
      </dl>

      <div className="space-y-1.5 sm:max-w-sm">
        <Label htmlFor="received-outside">
          Reçu hors du site (F, facultatif)
        </Label>
        <Input
          id="received-outside"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="0"
          value={outsideText}
          onChange={(e) => setOutsideText(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Espèces ou boutique externe : uniquement l&apos;argent réellement
          reçu.
        </p>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button type="submit" disabled={pending || !validOutside}>
        {pending ? "..." : `Valider pour ${fmt(amount)}`}
      </Button>
    </form>
  );
}
