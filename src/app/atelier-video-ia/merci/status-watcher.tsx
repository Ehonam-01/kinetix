"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackMarketingEvent, whenPixelReady } from "@/lib/marketing-events";
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

// Meta's Purchase and CompleteRegistration for a paid seat, and only ever
// rendered for a registration the server marked paid (the browser never
// decides it, see StatusWatcher). Once per registration: remembered in
// localStorage, which outlives the tab (a reload or the link opened again
// later sends nothing), and the registration id as eventID, so Meta itself
// counts a repeat once. The pixel loads a moment after the page, and not at
// all for a visitor who refused it (or, where the law asks for it, didn't
// accept it).
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
      // No storage: the eventID still keeps Meta from counting it twice.
    }
    return whenPixelReady(() => {
      trackMarketingEvent("Purchase", { value, currency: "XOF" });
      trackMarketingEvent(
        "CompleteRegistration",
        {
          value,
          currency: "XOF",
          content_name: "Kinetix AI Video Masterclass",
        },
        { eventID: registrationId },
      );
      try {
        localStorage.setItem(key, "1");
      } catch {
        // See above.
      }
    });
  }, [registrationId, value]);
  return null;
}
