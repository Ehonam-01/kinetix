"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmRechargeAction,
  initiateRechargeAction,
  lookupMemberAction,
} from "./actions";

export function RechargeForm({
  initialUsername,
}: {
  initialUsername: string;
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [username, setUsername] = useState(initialUsername);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [memberName, setMemberName] = useState<string | null>(null);
  // Same pattern as dashboard/transfer/transfer-form.tsx's recipientName —
  // tracks which trimmed pseudo the last lookup actually answered, so
  // "no match" and "haven't looked up the current input yet" stay distinct
  // without a third boolean, and every setState stays inside the debounce
  // callback rather than the effect body.
  const [memberAnsweredFor, setMemberAnsweredFor] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) return;
    const timeout = setTimeout(() => {
      lookupMemberAction(trimmed).then((result) => {
        setMemberName(result.fullName);
        setMemberAnsweredFor(trimmed);
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [username]);

  function handleInitiate() {
    setError(null);
    const parsedAmount = Number(amount);
    if (
      !username.trim() ||
      !Number.isInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError("Renseignez un pseudo et un montant valides.");
      return;
    }
    startTransition(async () => {
      const result = await initiateRechargeAction(
        username.trim(),
        parsedAmount,
        reason.trim() || undefined,
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
      const result = await confirmRechargeAction(requestId, code);
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
    setAmount("");
    setReason("");
    setError(null);
  }

  if (step === "done") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-green-600">
          Solde crédité avec succès.
        </p>
        <Button size="sm" variant="outline" onClick={reset}>
          Faire une nouvelle recharge
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
          <Label htmlFor="recharge-code">Code de confirmation</Label>
          <Input
            id="recharge-code"
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
            {pending ? "Vérification..." : "Confirmer la recharge"}
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
        <Label htmlFor="recharge-username">Pseudo du membre</Label>
        <Input
          id="recharge-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        {username.trim() &&
          memberAnsweredFor === username.trim() &&
          (memberName ? (
            <p className="text-sm text-green-600">Membre : {memberName}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun membre ne correspond à ce pseudo.
            </p>
          ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="recharge-amount">Montant à créditer (F CFA)</Label>
        <Input
          id="recharge-amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="recharge-reason">Motif (optionnel)</Label>
        <Input
          id="recharge-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleInitiate}>
        {pending ? "Envoi..." : "Recevoir un code de confirmation"}
      </Button>
    </div>
  );
}
