"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmMfaEnrollmentAction,
  startMfaEnrollmentAction,
  verifyMfaAction,
} from "./actions";

function CodeField({
  code,
  onChange,
}: {
  code: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="mfa-code">Code à 6 chiffres</Label>
      <Input
        id="mfa-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );
}

export function MfaEnrollForm() {
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Installez une application d&apos;authentification sur votre
          téléphone (Google Authenticator, Microsoft Authenticator ou Authy),
          puis cliquez ci-dessous pour afficher le QR code à scanner.
        </p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button
          className="w-full"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await startMfaEnrollmentAction();
              if (result.error || !result.enrollment) {
                setError(result.error ?? "Une erreur est survenue.");
                return;
              }
              setEnrollment(result.enrollment);
            })
          }
        >
          {pending ? "Préparation..." : "Configurer la double authentification"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Scannez ce QR code avec votre application, puis saisissez le code
        qu&apos;elle affiche.
      </p>
      {/* Supabase returns the QR code as an SVG data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enrollment.qrCode}
        alt="QR code de double authentification"
        className="mx-auto size-48 rounded-lg bg-white p-2"
      />
      <p className="text-muted-foreground text-center text-xs break-all">
        Impossible de scanner ? Saisissez cette clé dans l&apos;application :{" "}
        <span className="font-mono">{enrollment.secret}</span>
      </p>
      <CodeField code={code} onChange={setCode} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        className="w-full"
        disabled={pending || code.length !== 6}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // Only returns on failure — success redirects to /admin.
            const result = await confirmMfaEnrollmentAction(
              enrollment.factorId,
              code,
            );
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Vérification..." : "Activer"}
      </Button>
    </div>
  );
}

export function MfaVerifyForm() {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Saisissez le code affiché par votre application d&apos;authentification.
      </p>
      <CodeField code={code} onChange={setCode} />
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button
        className="w-full"
        disabled={pending || code.length !== 6}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await verifyMfaAction(code);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Vérification..." : "Valider"}
      </Button>
    </div>
  );
}
