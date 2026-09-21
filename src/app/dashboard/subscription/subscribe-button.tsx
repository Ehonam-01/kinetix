"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BICTORYS_COUNTRY_OPTIONS } from "@/config/bictorys-countries";
import { OPERATORS_BY_COUNTRY } from "@/config/bictorys-country-operators";
import { MOBILE_MONEY_OPERATOR_OPTIONS } from "@/config/mobile-money-operators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkSubscriptionConfirmedAction, subscribeAction } from "./actions";

// ~5 minutes at 4s per poll — long enough for a real SMS/USSD confirmation,
// short enough not to poll forever if the member never confirms on their
// phone (or the payment genuinely failed silently on the operator's side).
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 75;

export function SubscribeButton({ price }: { price: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<
    string | null
  >(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pollOutcome, setPollOutcome] = useState<"failed" | "timeout" | null>(
    null,
  );

  const availableOperators = country
    ? MOBILE_MONEY_OPERATOR_OPTIONS.filter((o) =>
        (OPERATORS_BY_COUNTRY[country] ?? []).includes(o.value),
      )
    : MOBILE_MONEY_OPERATOR_OPTIONS;

  // Polls for the webhook's own confirmation instead of asking the member
  // to reload manually — there's no way to push it straight to this one
  // open tab, so the client asks. router.refresh() re-renders
  // dashboard/layout.tsx's server-side gate, which is what actually
  // unlocks the dashboard once profiles.status flips to ACTIVE; for a
  // renewal (already ACTIVE) it just re-renders this page with the
  // updated expiry date instead.
  useEffect(() => {
    if (!paymentId || confirmed || pollOutcome) return;
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

  function handleCountryChange(next: string) {
    setCountry(next);
    // The previously picked operator may not exist in the new country —
    // never leave an invalid pairing selected.
    setOperator("");
  }

  function handleClick() {
    setError(null);
    if (!country || !operator || !phone.trim()) {
      setError("Renseignez un pays, un opérateur et un numéro mobile money.");
      return;
    }
    startTransition(async () => {
      // On success with a hosted checkout page (Moneroo, or Bictorys with
      // no operator recognized), this never resolves normally —
      // subscribeAction redirects server-side. It only resolves here on a
      // provider error, or on Bictorys' direct-softpay success (no page to
      // redirect to — confirmationMessage tells the member what happens
      // next instead, and polling above takes over from there).
      const result = await subscribeAction(country, operator, phone.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmationMessage(
        result.confirmationMessage ??
          "Vérifiez votre téléphone pour confirmer le paiement.",
      );
      setPaymentId(result.paymentId);
    });
  }

  if (confirmationMessage) {
    if (pollOutcome === "failed") {
      return (
        <div className="space-y-2">
          <p className="text-destructive text-sm">
            Le paiement a échoué. Veuillez réessayer.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmationMessage(null);
              setPaymentId(null);
              setPollOutcome(null);
            }}
          >
            Réessayer
          </Button>
        </div>
      );
    }
    return (
      <p
        className={`text-sm ${confirmed ? "text-green-600" : pollOutcome === "timeout" ? "text-muted-foreground" : "text-green-600"}`}
      >
        {confirmationMessage}{" "}
        {confirmed
          ? "Paiement confirmé !"
          : pollOutcome === "timeout"
            ? "Nous n'avons pas encore reçu de confirmation. Si vous avez déjà payé, patientez quelques minutes puis rechargez la page ; sinon réessayez."
            : "En attente de confirmation — cette page se mettra à jour automatiquement."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="subscribe-country">Pays</Label>
        <select
          id="subscribe-country"
          value={country}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none focus-visible:ring-3 md:text-sm"
        >
          <option value="">Choisir un pays</option>
          {BICTORYS_COUNTRY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subscribe-operator">Opérateur</Label>
        <select
          id="subscribe-operator"
          value={operator}
          disabled={!country}
          onChange={(e) => setOperator(e.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none focus-visible:ring-3 disabled:opacity-50 md:text-sm"
        >
          <option value="">
            {country ? "Choisir un opérateur" : "Choisissez d'abord un pays"}
          </option>
          {availableOperators.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subscribe-phone">Numéro mobile money</Label>
        <Input
          id="subscribe-phone"
          placeholder="+228..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleClick} className="w-full">
        {pending
          ? "Envoi de la demande de paiement..."
          : `Payer — ${price.toLocaleString("fr-FR")} F`}
      </Button>
    </div>
  );
}
