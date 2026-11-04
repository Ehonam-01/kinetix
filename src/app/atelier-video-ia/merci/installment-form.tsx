"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MIN_WORKSHOP_INSTALLMENT,
  type WorkshopInstallmentInput,
} from "@/schemas/workshop";
import { NON_REFUNDABLE_NOTE } from "../_components/content";
import { OperatorPicker } from "../_components/payment-logos";
import { payMoreForWorkshopAction } from "../actions";

// Another part towards a seat already held: any amount from the minimum
// (or what is left, if less) up to what is left.
export function InstallmentForm({
  token,
  left,
  defaultPhone,
}: {
  token: string;
  left: number;
  defaultPhone: string;
}) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(String(left));
  const [operator, setOperator] = useState("");
  const [paymentPhone, setPaymentPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);
  const minimum = Math.min(MIN_WORKSHOP_INSTALLMENT, left);
  const value = Number(amount);
  const valid = Number.isInteger(value) && value >= minimum && value <= left;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await payMoreForWorkshopAction({
        token,
        amount: value,
        operator: operator as WorkshopInstallmentInput["operator"],
        paymentPhone,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div className="space-y-1.5">
        <Label htmlFor="versement-amount">Montant à verser (F CFA)</Label>
        <Input
          id="versement-amount"
          required
          type="number"
          inputMode="numeric"
          min={minimum}
          max={left}
          step={1}
          className="h-11 text-base"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          De {minimum.toLocaleString("fr-FR")} F à{" "}
          {left.toLocaleString("fr-FR")} F.
        </p>
      </div>
      <OperatorPicker
        name="versement-operator"
        value={operator}
        onChange={setOperator}
      />
      <div className="space-y-1.5">
        <Label htmlFor="versement-phone">Numéro Mobile Money</Label>
        <Input
          id="versement-phone"
          required
          type="tel"
          placeholder="90 00 00 00"
          className="h-11 text-base"
          value={paymentPhone}
          onChange={(e) => setPaymentPhone(e.target.value)}
        />
      </div>

      <p className="text-muted-foreground text-xs">{NON_REFUNDABLE_NOTE}</p>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || !valid}
        className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-auto min-h-12 w-full rounded-xl py-3 text-base font-bold whitespace-normal"
      >
        {pending ? (
          "Envoi de la demande de paiement..."
        ) : (
          <>
            <Lock className="size-5" />
            Verser {(valid ? value : left).toLocaleString("fr-FR")} F
          </>
        )}
      </Button>
    </form>
  );
}
