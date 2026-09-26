"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmWalletSubscriptionAction,
  requestWalletSubscriptionAction,
} from "./actions";

export function WalletSubscribeForm({
  price,
  defaultUsername,
}: {
  price: number;
  defaultUsername: string;
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<
    "form" | "otp" | "awaitingOwner" | "done"
  >("form");
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
      const result = await requestWalletSubscriptionAction(
        walletUsername.trim(),
      );
      if (result.error || !result.requestId) {
        setError(result.error ?? "Une erreur est survenue.");
        return;
      }
      setRequestId(result.requestId);
      setStep(result.ownerApproval ? "awaitingOwner" : "otp");
    });
  }

  function handleConfirm() {
    setError(null);
    if (!requestId) return;
    startTransition(async () => {
      const result = await confirmWalletSubscriptionAction(requestId, code);
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
        Abonnement confirmé — toutes les formations sont maintenant accessibles.
      </p>
    );
  }

  if (step === "awaitingOwner") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Demande envoyée à « {walletUsername} ». Pour des raisons de
          sécurité, c&apos;est ce membre qui la valide depuis son propre
          espace (page « Transférer ») — vous n&apos;avez pas de code à saisir.
          La demande expire dans 30 minutes ; rechargez cette page une fois
          qu&apos;il l&apos;a acceptée.
        </p>
        <Button variant="outline" onClick={reset}>
          Recommencer
        </Button>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Un code à 6 chiffres a été envoyé à l&apos;adresse email de votre
          compte. Il expire dans 5 minutes.
        </p>
        <div className="space-y-2">
          <Label htmlFor="subscription-otp">Code de confirmation</Label>
          <Input
            id="subscription-otp"
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
            {pending ? "Vérification..." : "Confirmer l'abonnement"}
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
        <Label htmlFor="subscription-wallet-username">
          Wallet à débiter (pseudo)
        </Label>
        <Input
          id="subscription-wallet-username"
          value={walletUsername}
          onChange={(e) => setWalletUsername(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {isSelf
            ? "Votre propre solde."
            : "Le solde d'un autre membre — il devra accepter la demande depuis son propre espace."}
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
