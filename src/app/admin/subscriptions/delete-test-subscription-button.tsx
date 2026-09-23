"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteTestSubscriptionAction } from "./actions";

// Same two-step reveal-then-confirm shape as admin/withdrawals/
// review-actions.tsx, for the one destructive, non-reversible action on
// this page — deleting a subscription record entirely, reserved for a
// test/simulation payment that was never a real sale (see
// services/admin/delete-test-subscription.ts).
export function DeleteTestSubscriptionButton({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteTestSubscriptionAction(subscriptionId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleted(true);
    });
  }

  if (deleted) {
    return <span className="text-muted-foreground text-xs">Supprimé.</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-destructive text-xs hover:underline"
      >
        Supprimer (test)
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={handleDelete}
        >
          {pending ? "Suppression..." : "Confirmer la suppression"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Annuler
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
