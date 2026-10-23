"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmMfaEnrollmentAction,
  startMfaEnrollmentAction,
  verifyMfaAction,
} from "./actions";

// The 6-digit code. As soon as the 6th digit is typed (or the code is
// pasted), onComplete runs: no need to press the button, which stays as a
// fallback.
function CodeField({
  code,
  onChange,
  onComplete,
  disabled,
  inputRef,
}: {
  code: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="mfa-code">Code à 6 chiffres</Label>
      <Input
        id="mfa-code"
        ref={inputRef}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        disabled={disabled}
        className="text-center text-lg tracking-[0.4em]"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(digits);
          if (digits.length === 6) onComplete(digits);
        }}
      />
    </div>
  );
}

// Runs a code check once per code: a code already being checked isn't sent
// twice (the 6th digit and a click on the button arriving together). After
// a refusal, the field is emptied and focused for the next try.
function useCodeSubmit(
  check: (code: string) => Promise<{ error?: string | null } | undefined>,
) {
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(value: string) {
    if (value.length !== 6 || inFlight.current === value) return;
    inFlight.current = value;
    setError(null);
    startTransition(async () => {
      // Only returns on failure — success redirects to /admin.
      const result = await check(value);
      if (result?.error) {
        setError(result.error);
        setCode("");
        inFlight.current = null;
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    });
  }

  return { pending, code, setCode, error, submit, inputRef };
}

export function MfaEnrollForm() {
  const [pending, startTransition] = useTransition();
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useCodeSubmit((code) =>
    confirmMfaEnrollmentAction(enrollment!.factorId, code),
  );

  if (!enrollment) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Installez une application d&apos;authentification sur votre téléphone
          (Google Authenticator, Microsoft Authenticator ou Authy), puis cliquez
          ci-dessous pour afficher le QR code à scanner.
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
      <CodeField
        code={confirm.code}
        onChange={confirm.setCode}
        onComplete={confirm.submit}
        disabled={confirm.pending}
        inputRef={confirm.inputRef}
      />
      {confirm.error && (
        <p className="text-destructive text-sm">{confirm.error}</p>
      )}
      <Button
        className="w-full"
        disabled={confirm.pending || confirm.code.length !== 6}
        onClick={() => confirm.submit(confirm.code)}
      >
        {confirm.pending ? "Vérification..." : "Activer"}
      </Button>
    </div>
  );
}

export function MfaVerifyForm() {
  const verify = useCodeSubmit((code) => verifyMfaAction(code));

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Saisissez le code affiché par votre application d&apos;authentification
        : il est vérifié dès le 6e chiffre.
      </p>
      <CodeField
        code={verify.code}
        onChange={verify.setCode}
        onComplete={verify.submit}
        disabled={verify.pending}
        inputRef={verify.inputRef}
      />
      {verify.error && (
        <p className="text-destructive text-sm">{verify.error}</p>
      )}
      <Button
        className="w-full"
        disabled={verify.pending || verify.code.length !== 6}
        onClick={() => verify.submit(verify.code)}
      >
        {verify.pending ? "Vérification..." : "Valider"}
      </Button>
    </div>
  );
}
