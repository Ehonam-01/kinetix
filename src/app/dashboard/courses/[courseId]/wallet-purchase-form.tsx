"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmWalletPurchaseAction,
  requestWalletPurchaseAction,
} from "./purchase-actions";

export function WalletPurchaseForm({
  courseId,
  price,
  defaultUsername,
}: {
  courseId: string;
  price: number;
  defaultUsername: string;
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"form" | "otp" | "done">("form");
  const [walletUsername, setWalletUsername] = useState(defaultUsername);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSelf = walletUsername.trim() === defaultUsername;

  function handleRequest() {
    setError(null);
    if (!walletUsername.trim()) {
      setError("Renseignez le pseudo du membre à débiter.");
      return;
    }
    startTransition(async () => {
      const result = await requestWalletPurchaseAction(
        courseId,
        walletUsername.trim(),
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
      const result = await confirmWalletPurchaseAction(
        courseId,
        requestId,
        code,
      );
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
      <p className="text-sm text-green-600">
        Achat confirmé — la formation est maintenant accessible.
      </p>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Un code à 6 chiffres a été envoyé à l&apos;adresse email{" "}
          {isSelf ? "de votre compte" : `du compte « ${walletUsername} »`}. Il
          expire dans 10 minutes.
        </p>
        <div className="space-y-2">
          <Label htmlFor="wallet-otp">Code de confirmation</Label>
          <Input
            id="wallet-otp"
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
            {pending ? "Vérification..." : "Confirmer l'achat"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={reset}>
            Recommencer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wallet-username">Wallet à débiter (pseudo)</Label>
        <Input
          id="wallet-username"
          value={walletUsername}
          onChange={(e) => setWalletUsername(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {isSelf
            ? "Votre propre solde."
            : "Le solde d'un autre membre — il devra confirmer avec le code reçu par email."}
        </p>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleRequest} className="w-full">
        {pending
          ? "Envoi..."
          : `Payer ${price.toLocaleString("fr-FR")} F avec ce wallet`}
      </Button>
    </div>
  );
}
