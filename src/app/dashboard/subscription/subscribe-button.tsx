"use client";

import { useState, useTransition } from "react";
import { MOBILE_MONEY_OPERATOR_OPTIONS } from "@/config/mobile-money-operators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subscribeAction } from "./actions";

export function SubscribeButton({ price }: { price: number }) {
  const [pending, startTransition] = useTransition();
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<
    string | null
  >(null);

  function handleClick() {
    setError(null);
    if (!operator || !phone.trim()) {
      setError("Renseignez un opérateur et un numéro mobile money.");
      return;
    }
    startTransition(async () => {
      // On success with a hosted checkout page (Moneroo, or Bictorys with
      // no operator recognized), this never resolves normally —
      // subscribeAction redirects server-side. It only resolves here on a
      // provider error, or on Bictorys' direct-softpay success (no page to
      // redirect to — confirmationMessage tells the member what happens
      // next instead).
      const result = await subscribeAction(operator, phone.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmationMessage(
        result.confirmationMessage ??
          "Vérifiez votre téléphone pour confirmer le paiement.",
      );
    });
  }

  if (confirmationMessage) {
    return (
      <p className="text-sm text-green-600">
        {confirmationMessage} Rechargez cette page une fois confirmé.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="subscribe-operator">Opérateur</Label>
        <select
          id="subscribe-operator"
          value={operator}
          onChange={(e) => setOperator(e.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none focus-visible:ring-3 md:text-sm"
        >
          <option value="">Choisir un opérateur</option>
          {MOBILE_MONEY_OPERATOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subscribe-phone">Numéro mobile money</Label>
        <Input
          id="subscribe-phone"
          placeholder="+228..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleClick} className="w-full">
        {pending
          ? "Envoi de la demande de paiement..."
          : `Payer — ${price.toLocaleString("fr-FR")} F`}
      </Button>
    </div>
  );
}
