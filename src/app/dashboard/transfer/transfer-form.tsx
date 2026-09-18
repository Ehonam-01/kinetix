"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmTransferAction,
  initiateTransferAction,
  lookupRecipientAction,
} from "./actions";

export function TransferForm() {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [recipientUsername, setRecipientUsername] = useState("");
  const [amount, setAmount] = useState("");
  const [transferId, setTransferId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [recipientName, setRecipientName] = useState<string | null>(null);
  // Which trimmed pseudo recipientName actually answers — lets the render
  // below tell "no match for the current input" apart from "haven't
  // looked up the current input yet" without a second boolean, and means
  // every setState here happens inside the timeout's callback, never
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  const [recipientAnsweredFor, setRecipientAnsweredFor] = useState<
    string | null
  >(null);

  // Debounced live lookup — fires ~400ms after typing stops, not on every
  // keystroke.
  useEffect(() => {
    const trimmed = recipientUsername.trim();
    if (!trimmed) return;
    const timeout = setTimeout(() => {
      lookupRecipientAction(trimmed).then((result) => {
        setRecipientName(result.fullName);
        setRecipientAnsweredFor(trimmed);
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [recipientUsername]);

  function handleInitiate() {
    setError(null);
    const parsedAmount = Number(amount);
    if (
      !recipientUsername.trim() ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError("Renseignez un pseudo et un montant valides.");
      return;
    }
    startTransition(async () => {
      const result = await initiateTransferAction(
        recipientUsername.trim(),
        parsedAmount,
      );
      if (result.error || !result.transferId) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setTransferId(result.transferId);
      setStep("otp");
    });
  }

  function handleConfirm() {
    setError(null);
    if (!transferId) return;
    startTransition(async () => {
      const result = await confirmTransferAction(transferId, code);
      if (result.error) {
        setError(result.error);
        return;
      }
      setStep("done");
    });
  }

  function reset() {
    setStep("form");
    setTransferId(null);
    setCode("");
    setError(null);
  }

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-600">
          Transfert confirmé — le solde a été mis à jour.
        </p>
        <Button size="sm" variant="outline" onClick={reset}>
          Faire un nouveau transfert
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
            {pending ? "Vérification..." : "Confirmer le transfert"}
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
        <Label htmlFor="recipient">Pseudo du destinataire</Label>
        <Input
          id="recipient"
          value={recipientUsername}
          onChange={(e) => setRecipientUsername(e.target.value)}
        />
        {recipientUsername.trim() &&
          recipientAnsweredFor === recipientUsername.trim() &&
          (recipientName ? (
            <p className="text-sm text-green-600">
              Destinataire : {recipientName}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun membre ne correspond à ce pseudo.
            </p>
          ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Montant (F CFA)</Label>
        <Input
          id="amount"
          type="number"
          min={1}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleInitiate}>
        {pending ? "Envoi..." : "Recevoir un code de confirmation"}
      </Button>
    </div>
  );
}
