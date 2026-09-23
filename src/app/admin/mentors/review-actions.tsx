"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approveMentorRequestAction, rejectMentorRequestAction } from "./actions";

// Same reveal-then-confirm shape as admin/withdrawals/review-actions.tsx.
export function ReviewActions({ mentorProfileId }: { mentorProfileId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveMentorRequestAction(mentorProfileId);
      if (result.error) setError(result.error);
    });
  }

  function handleReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectMentorRequestAction(mentorProfileId, reason);
      if (result.error) setError(result.error);
    });
  }

  if (!rejecting) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" disabled={pending} onClick={handleApprove}>
            {pending ? "Validation..." : "Valider"}
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
        <Label htmlFor={`reason-${mentorProfileId}`}>Motif du refus</Label>
        <Input
          id={`reason-${mentorProfileId}`}
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
