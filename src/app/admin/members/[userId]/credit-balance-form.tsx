"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creditMemberBalanceAction } from "./actions";

export function CreditBalanceForm({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleClick() {
    setError(null);
    setSuccess(false);
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Renseignez un montant valide.");
      return;
    }
    startTransition(async () => {
      const result = await creditMemberBalanceAction(
        userId,
        parsedAmount,
        reason.trim() || undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setAmount("");
      setReason("");
      setSuccess(true);
    });
  }

  return (
    <div className="max-w-sm space-y-3">
      <div className="space-y-2">
        <Label htmlFor="credit-amount">Montant à créditer (F CFA)</Label>
        <Input
          id="credit-amount"
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="credit-reason">Motif (optionnel)</Label>
        <Input
          id="credit-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">Solde crédité avec succès.</p>
      )}
      <Button size="sm" variant="outline" disabled={pending} onClick={handleClick}>
        {pending ? "Crédit en cours..." : "Créditer le solde"}
      </Button>
    </div>
  );
}
