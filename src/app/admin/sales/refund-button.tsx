"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refundSaleAction } from "./actions";

export function RefundButton({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Rembourser
      </Button>
    );
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await refundSaleAction(saleId, {
        reason: reason || undefined,
        revokeAccess,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="space-y-1">
        <Label htmlFor={`reason-${saleId}`}>Motif (optionnel)</Label>
        <Input
          id={`reason-${saleId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={revokeAccess}
          onChange={(e) => setRevokeAccess(e.target.checked)}
        />
        Révoquer l&apos;accès à la formation
      </label>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={handleConfirm}>
          {pending ? "Remboursement..." : "Confirmer le remboursement"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
