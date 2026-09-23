"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { checkSubscriptionConfirmedAction } from "./actions";

// Same poll as SubscribeButton/PaydunyaSubscribeForm, but started from a
// server-found paymentId instead of one just returned by subscribeAction —
// covers the hosted-checkout redirect path (Moneroo, or PayDunya/Bictorys
// with no operator recognized): the member leaves for the provider's own
// page and comes straight back to dashboard/subscription with nothing in
// the URL to poll, no open tab still holding the paymentId from the
// original click. Without this, a slow or misconfigured webhook left that
// return trip showing "no active subscription" until the member manually
// reloaded — this is what makes it automatic instead.
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 75;

export function PendingPaymentWatcher({
  paymentId,
  fallback,
}: {
  paymentId: string;
  // Shown once polling gives up (failed, or 5 minutes with no news) —
  // FrozenAccountScreen passes its own SubscriptionPanel here so a member
  // whose payment genuinely failed isn't stuck staring at a dead end with
  // no way to pay again.
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [pollOutcome, setPollOutcome] = useState<"failed" | "timeout" | null>(
    null,
  );

  useEffect(() => {
    if (confirmed || pollOutcome) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      checkSubscriptionConfirmedAction(paymentId)
        .then((status) => {
          if (status === "CONFIRMED") {
            clearInterval(interval);
            setConfirmed(true);
            router.refresh();
          } else if (status === "FAILED") {
            clearInterval(interval);
            setPollOutcome("failed");
          } else if (attempts >= MAX_POLLS) {
            clearInterval(interval);
            setPollOutcome("timeout");
          }
        })
        .catch(() => {
          clearInterval(interval);
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [paymentId, confirmed, pollOutcome, router]);

  if (confirmed) return null;

  if (pollOutcome === "failed") {
    return (
      <div className="space-y-3">
        <p className="text-destructive text-sm">
          Le paiement a échoué. Vous pouvez réessayer ci-dessous.
        </p>
        {fallback}
      </div>
    );
  }

  if (pollOutcome === "timeout") {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Nous n&apos;avons pas encore reçu de confirmation pour votre dernier
          paiement. Si vous avez déjà payé, patientez quelques minutes puis
          rechargez la page ; sinon vous pouvez réessayer ci-dessous.
        </p>
        {fallback}
      </div>
    );
  }

  return (
    <p className="text-sm text-green-600">
      Paiement en cours de confirmation — cette page se mettra à jour
      automatiquement, inutile de la recharger.
    </p>
  );
}
