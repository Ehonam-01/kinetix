"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmMemberDeletionAction,
  requestMemberDeletionAction,
} from "./actions";

export function DeleteAccountButton({ userId }: { userId: string }) {
  const [step, setStep] = useState<"idle" | "otp">("idle");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestMemberDeletionAction(userId);
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
      const result = await confirmMemberDeletionAction(
        userId,
        requestId,
        code,
      );
      if (result.error) setError(result.error);
    });
  }

  if (step === "idle") {
    return (
      <div className="space-y-2">
        <Button variant="destructive" disabled={pending} onClick={handleRequest}>
          {pending ? "Envoi..." : "Supprimer ce compte"}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-muted-foreground text-sm">
        Un code à 6 chiffres a été envoyé à votre propre adresse email.
        Anonymisation irréversible du profil et blocage définitif de la
        connexion.
      </p>
      <div className="space-y-1">
        <Label htmlFor={`delete-code-${userId}`}>Code de confirmation</Label>
        <Input
          id={`delete-code-${userId}`}
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || code.length !== 6}
          onClick={handleConfirm}
        >
          {pending ? "Suppression..." : "Confirmer la suppression"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setStep("idle");
            setCode("");
            setError(null);
          }}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
