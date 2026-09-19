"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BICTORYS_COUNTRY_OPTIONS } from "@/config/bictorys-countries";
import { MOBILE_MONEY_OPERATOR_OPTIONS } from "@/config/mobile-money-operators";
import {
  PAYDUNYA_OPERATORS_BY_COUNTRY,
} from "@/config/paydunya-country-operators";
import {
  PAYDUNYA_REQUIRES_ADDRESS,
  PAYDUNYA_REQUIRES_OTP,
  PAYDUNYA_REQUIRES_WIZALL_CONFIRM,
} from "@/config/paydunya-operator-requirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkSubscriptionConfirmedAction,
  confirmWizallPaymentAction,
  subscribeAction,
} from "./actions";

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 75;

// PayDunya only covers these 6 countries with operators this platform
// already lists (config/paydunya-country-operators.ts) — Cameroon (MTN) is
// in PayDunya's own coverage too but out of scope, see that file.
const COUNTRY_OPTIONS = BICTORYS_COUNTRY_OPTIONS;

export function PaydunyaSubscribeForm({ price }: { price: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [country, setCountry] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<
    string | null
  >(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [wizall, setWizall] = useState<{ transactionId: string } | null>(
    null,
  );
  const [wizallCode, setWizallCode] = useState("");

  const combo = country && operator ? `${country}:${operator}` : "";
  const needsOtp = PAYDUNYA_REQUIRES_OTP.has(combo as never);
  const needsAddress = PAYDUNYA_REQUIRES_ADDRESS.has(combo as never);

  const availableOperators = country
    ? MOBILE_MONEY_OPERATOR_OPTIONS.filter((o) =>
        (PAYDUNYA_OPERATORS_BY_COUNTRY[country] ?? []).includes(o.value),
      )
    : MOBILE_MONEY_OPERATOR_OPTIONS;

  // Same self-healing poll as SubscribeButton (Bictorys) — see that
  // component's comment for why it actively re-verifies instead of only
  // trusting a webhook to have already landed.
  useEffect(() => {
    if (!paymentId || confirmed || wizall) return;
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      checkSubscriptionConfirmedAction(paymentId)
        .then((isConfirmed) => {
          if (isConfirmed) {
            clearInterval(interval);
            setConfirmed(true);
            router.refresh();
          } else if (attempts >= MAX_POLLS) {
            clearInterval(interval);
          }
        })
        .catch(() => clearInterval(interval));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [paymentId, confirmed, wizall, router]);

  function handleCountryChange(next: string) {
    setCountry(next);
    setOperator("");
  }

  function handleOperatorChange(next: string) {
    setOperator(next);
    setOtp("");
    setAddress("");
  }

  function handleClick() {
    setError(null);
    if (
      !country ||
      !operator ||
      !phone.trim() ||
      (needsOtp && !otp.trim()) ||
      (needsAddress && !address.trim())
    ) {
      setError("Renseignez tous les champs requis pour cet opérateur.");
      return;
    }
    startTransition(async () => {
      const result = await subscribeAction(
        country,
        operator,
        phone.trim(),
        needsOtp ? otp.trim() : undefined,
        needsAddress ? address.trim() : undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.pendingWizallConfirmation) {
        setWizall(result.pendingWizallConfirmation);
        setPaymentId(result.paymentId);
        return;
      }
      setConfirmationMessage(
        result.confirmationMessage ??
          "Vérifiez votre téléphone pour confirmer le paiement.",
      );
      setPaymentId(result.paymentId);
    });
  }

  function handleWizallConfirm() {
    setError(null);
    if (!wizall || !paymentId || wizallCode.length < 4) {
      setError("Renseignez le code reçu par SMS.");
      return;
    }
    startTransition(async () => {
      const result = await confirmWizallPaymentAction(
        paymentId,
        wizall.transactionId,
        phone.trim(),
        wizallCode.trim(),
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmed(true);
      router.refresh();
    });
  }

  if (wizall) {
    return (
      <div className="max-w-sm space-y-3">
        <p className="text-muted-foreground text-sm">
          Un code de confirmation vous a été envoyé par SMS. Saisissez-le
          pour finaliser le paiement.
        </p>
        <div className="space-y-2">
          <Label htmlFor="wizall-code">Code de confirmation</Label>
          <Input
            id="wizall-code"
            value={wizallCode}
            onChange={(e) => setWizallCode(e.target.value)}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button disabled={pending} onClick={handleWizallConfirm} className="w-full">
          {pending ? "Confirmation..." : "Confirmer le paiement"}
        </Button>
      </div>
    );
  }

  if (confirmationMessage) {
    return (
      <p className="text-sm text-green-600">
        {confirmationMessage}{" "}
        {confirmed
          ? "Paiement confirmé !"
          : "En attente de confirmation — cette page se mettra à jour automatiquement."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="paydunya-country">Pays</Label>
        <select
          id="paydunya-country"
          value={country}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none focus-visible:ring-3 md:text-sm"
        >
          <option value="">Choisir un pays</option>
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="paydunya-operator">Opérateur</Label>
        <select
          id="paydunya-operator"
          value={operator}
          disabled={!country}
          onChange={(e) => handleOperatorChange(e.target.value)}
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
        {PAYDUNYA_REQUIRES_WIZALL_CONFIRM.has(combo as never) && (
          <p className="text-muted-foreground text-xs">
            Un code de confirmation vous sera envoyé par SMS après cette
            étape.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="paydunya-phone">Numéro mobile money</Label>
        <Input
          id="paydunya-phone"
          placeholder="+228..."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {needsOtp && (
        <div className="space-y-2">
          <Label htmlFor="paydunya-otp">
            Code USSD (composez le code fourni par votre opérateur)
          </Label>
          <Input
            id="paydunya-otp"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
        </div>
      )}
      {needsAddress && (
        <div className="space-y-2">
          <Label htmlFor="paydunya-address">Adresse</Label>
          <Input
            id="paydunya-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button disabled={pending} onClick={handleClick} className="w-full">
        {pending
          ? "Envoi de la demande de paiement..."
          : `Payer — ${price.toLocaleString("fr-FR")} F`}
      </Button>
    </div>
  );
}
