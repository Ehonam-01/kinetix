"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmAccountDeletionAction,
  requestAccountDeletionAction,
} from "./actions";

export function DeleteAccountForm() {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"warning" | "otp">("warning");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletionAction();
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
      // On success, confirmAccountDeletionAction signs out and redirects
      // server-side (it never returns) — only an {error} return means it
      // failed.
      const result = await confirmAccountDeletionAction(requestId, code);
      if (result?.error) setError(result.error);
    });
  }

  if (step === "otp") {
    return (
      <div className="max-w-sm space-y-4">
        <p className="text-muted-foreground text-sm">
          Un code à 6 chiffres a été envoyé à votre adresse email. Il expire
          dans 10 minutes.
        </p>
        <div className="space-y-2">
          <Label htmlFor="delete-code">Code de confirmation</Label>
          <Input
            id="delete-code"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            disabled={pending || code.length !== 6}
            onClick={handleConfirm}
          >
            {pending ? "Suppression..." : "Supprimer définitivement"}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setStep("warning");
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

  return (
    <div className="max-w-sm space-y-4">
      <p className="text-muted-foreground text-sm">
        Votre nom, pseudo, téléphone et profil communautaire seront
        définitivement effacés et la connexion bloquée. Cette action est
        irréversible et ne peut pas être annulée par la suite.
      </p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button variant="destructive" disabled={pending} onClick={handleRequest}>
        {pending ? "Envoi..." : "Supprimer mon compte"}
      </Button>
    </div>
  );
}
