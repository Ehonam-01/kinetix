"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PendingWalletPaymentRequest } from "@/repositories/subscriptions";
import { confirmWalletSubscriptionAction } from "../subscription/actions";

// Another member asked to pay their subscription from this wallet — only
// the wallet owner can confirm it, here, with the code emailed to them
// (services/subscriptions/confirm-subscription-wallet.ts).
export function PendingWalletRequests({
  requests,
}: {
  requests: PendingWalletPaymentRequest[];
}) {
  if (requests.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border p-5">
      <div>
        <h2 className="font-semibold">Demandes de paiement en attente</h2>
        <p className="text-muted-foreground text-sm">
          Ces membres vous demandent de payer leur abonnement depuis votre
          solde. Saisissez le code reçu par email pour accepter, ou ignorez la
          demande : elle expirera d&apos;elle-même sans rien débiter.
        </p>
      </div>
      {requests.map((request) => (
        <PendingWalletRequestRow key={request.id} request={request} />
      ))}
    </div>
  );
}

function PendingWalletRequestRow({
  request,
}: {
  request: PendingWalletPaymentRequest;
}) {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await confirmWalletSubscriptionAction(request.id, code);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <p className="text-sm text-green-600">
        Abonnement de {request.buyerFullName} (@{request.buyerUsername}) payé.
      </p>
    );
  }

  const inputId = `wallet-request-otp-${request.id}`;
  return (
    <div className="space-y-2 rounded-xl border px-4 py-3 text-sm">
      <p className="font-medium">
        {request.buyerFullName} (@{request.buyerUsername}) —{" "}
        {request.amount.toLocaleString("fr-FR")} F
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor={inputId}>Code reçu par email</Label>
          <Input
            id={inputId}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button disabled={pending || code.length !== 6} onClick={handleConfirm}>
          {pending ? "Paiement..." : "Payer"}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
