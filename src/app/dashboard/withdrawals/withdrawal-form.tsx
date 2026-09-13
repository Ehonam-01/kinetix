"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmWithdrawalAction, requestWithdrawalAction } from "./actions";

export function WithdrawalForm({ minimumAmount }: { minimumAmount: number }) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [amount, setAmount] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleRequest() {
    setError(null);
    const parsedAmount = Number(amount);
    if (
      !payoutPhone.trim() ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError("Renseignez un numéro mobile money et un montant valides.");
      return;
    }
    startTransition(async () => {
      const result = await requestWithdrawalAction(
        parsedAmount,
        payoutPhone.trim(),
      );
      if (result.error || !result.requestId) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setRequestId(result.requestId);
      setStep("otp");
    });
  }

  function handleConfirm() {
    setError(null);
    if (!requestId) return;
    startTransition(async () => {
      const result = await confirmWithdrawalAction(requestId, code);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("done");
    });
  }

  function reset() {
    setStep("form");
    setRequestId(null);
    setCode("");
    setError(null);
  }

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-600">
          Demande de retrait confirmée — elle sera traitée par un
          administrateur.
        </p>
        <Button size="sm" variant="outline" onClick={reset}>
          Faire une nouvelle demande
        </Button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="max-w-sm space-y-4">
        <p className="text-muted-foreground text-sm">
          Un code à 6 chiffres a été envoyé à votre adresse email. Il expire
          dans 10 minutes.
        </p>
        <div className="space-y-2">
          <Label htmlFor="code">Code de confirmation</Label>
          <Input
            id="code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={pending || code.length !== 6}
            onClick={handleConfirm}
          >
            {pending ? "Vérification..." : "Confirmer le retrait"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={reset}>
            Recommencer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="payoutPhone">Numéro mobile money</Label>
        <Input
          id="payoutPhone"
          placeholder="+228..."
          value={payoutPhone}
          onChange={(e) => setPayoutPhone(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Montant (F CFA)</Label>
        <Input
          id="amount"
          type="number"
          min={minimumAmount}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Minimum : {minimumAmount.toLocaleString("fr-FR")} F
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleRequest}>
        {pending ? "Envoi..." : "Recevoir un code de confirmation"}
      </Button>
    </div>
  );
}
