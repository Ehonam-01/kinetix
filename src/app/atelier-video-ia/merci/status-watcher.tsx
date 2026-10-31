"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackMarketingEvent } from "@/lib/marketing-events";
import { checkWorkshopRegistrationAction } from "../actions";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 75;

// Waits for the server to confirm the payment: the browser never decides
// anything here, it only asks (services/workshops/check-status.ts).
export function StatusWatcher({ token }: { token: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      checkWorkshopRegistrationAction(token)
        .then((status) => {
          if (status === "PAID" || status === "FAILED") {
            clearInterval(interval);
            router.refresh();
          } else if (attempts >= MAX_POLLS) {
            clearInterval(interval);
            setTimedOut(true);
          }
        })
        .catch(() => {
          if (attempts >= MAX_POLLS) {
            clearInterval(interval);
            setTimedOut(true);
          }
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, router]);

  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      {timedOut
        ? "Nous n'avons pas encore reçu de confirmation. Si tu as déjà payé, patiente quelques minutes puis recharge cette page."
        : "En attente de confirmation : cette page se mettra à jour automatiquement."}
    </p>
  );
}

const PIXEL_WAIT_TRIES = 10;

// Meta's Purchase, once per registration, and only ever rendered for a
// registration the server marked paid. The pixel loads a moment after the
// page, and not at all without the visitor's consent.
export function PurchaseTracker({
  registrationId,
  value,
}: {
  registrationId: string;
  value: number;
}) {
  useEffect(() => {
    const key = `kx-atelier-purchase:${registrationId}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // No storage: it may count twice, never blocks the page.
    }
    let tries = 0;
    const interval = setInterval(() => {
      tries += 1;
      const loaded = "fbq" in window;
      if (loaded) {
        trackMarketingEvent("Purchase", { value, currency: "XOF" });
        try {
          localStorage.setItem(key, "1");
        } catch {
          // See above.
        }
      }
      if (loaded || tries >= PIXEL_WAIT_TRIES) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [registrationId, value]);
  return null;
}
