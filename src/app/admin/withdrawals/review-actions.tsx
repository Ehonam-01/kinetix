"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveWithdrawalAction, rejectWithdrawalAction } from "./actions";

export function ReviewActions({ requestId }: { requestId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveWithdrawalAction(requestId);
      if (result.error) setError(result.error);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectWithdrawalAction(requestId, reason);
      if (result.error) setError(result.error);
    });
  }

  if (!rejecting) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={handleApprove}>
            {pending ? "Envoi du virement..." : "Déclencher le virement"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setRejecting(true)}
          >
            Refuser
          </Button>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="space-y-1">
        <Label htmlFor={`reason-${requestId}`}>Motif du refus</Label>
        <Input
          id={`reason-${requestId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending || !reason.trim()}
          onClick={handleReject}
        >
          {pending ? "Refus..." : "Confirmer le refus"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setRejecting(false)}
        >
          Annuler
        </Button>
      </div>
    </div>
  );
}
