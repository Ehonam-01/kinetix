"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Lock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MIN_WORKSHOP_INSTALLMENT,
  toWorkshopPhone,
  type WorkshopRegistrationInput,
} from "@/schemas/workshop";
import {
  lookupWorkshopBalanceAction,
  registerForWorkshopAction,
} from "../actions";
import type { HeldSeat } from "@/services/workshops/register";
import { cn } from "@/lib/utils";
import { NON_REFUNDABLE_NOTE } from "./content";
import { OperatorPicker } from "./payment-logos";
import { sessionDay } from "./sessions";
import { useWorkshopLive, WhatsappButton } from "./workshop-live";

type Values = Omit<WorkshopRegistrationInput, "amount" | "sessionId">;

const EMPTY: Values = {
  fullName: "",
  whatsapp: "",
  email: "",
  operator: "" as WorkshopRegistrationInput["operator"],
  paymentPhone: "",
};

// Three steps, one screen each (explicit user decision): the city, who is
// coming, then the payment.
type Step = "city" | "identity" | "payment";
const STEPS: { step: Step; label: string }[] = [
  { step: "city", label: "Ville" },
  { step: "identity", label: "Tes infos" },
  { step: "payment", label: "Paiement" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const primaryButton =
  "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 shadow-brand-accent/30 h-auto min-h-14 w-full rounded-xl py-3 text-base font-bold whitespace-normal shadow-lg";

export function RegistrationForm() {
  const { sessions, open, whatsappUrl, markClosed } = useWorkshopLive();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY);
  // The city (explicit user decision: the same workshop in several cities,
  // each with its own date, place, price and seats). Only one still on sale
  // is chosen already.
  const onSale = sessions.filter((session) => session.open);
  const [sessionId, setSessionId] = useState(
    onSale.length === 1 ? onSale[0].id : "",
  );
  const session = onSale.find((s) => s.id === sessionId) ?? null;
  const [step, setStep] = useState<Step>("city");
  // Payment in parts (explicit user decision): the whole price, or a first
  // part from MIN_WORKSHOP_INSTALLMENT, the rest later or at the door.
  const [inParts, setInParts] = useState(false);
  const [part, setPart] = useState(String(MIN_WORKSHOP_INSTALLMENT));
  const [error, setError] = useState<string | null>(null);
  // This WhatsApp number already holds a seat (explicit user decision: they
  // come back through this same form): the form then pays what is left on
  // it, wholly or in part, whatever city was picked.
  const [balance, setBalance] = useState<HeldSeat | null>(null);
  const [started, setStarted] = useState(false);
  const typedPhone = toWorkshopPhone(values.whatsapp);
  const topRef = useRef<HTMLFormElement>(null);

  // As soon as the number is complete, its situation shows: a seat already
  // held, and what is left to pay on it.
  useEffect(() => {
    if (!typedPhone) return;
    let current = true;
    const timer = setTimeout(async () => {
      const found = await lookupWorkshopBalanceAction(typedPhone);
      if (!current || !found) return;
      setBalance(found);
      setInParts(false);
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [typedPhone]);

  const due = balance?.left ?? session?.price ?? 0;
  const partAmount = Number(part);
  const amount = inParts ? partAmount : due;
  const amountValid =
    Number.isInteger(amount) &&
    amount >= Math.min(MIN_WORKSHOP_INSTALLMENT, due) &&
    amount <= due;

  function set(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    // Another number: whatever was found for the previous one no longer
    // applies.
    if (field === "whatsapp") {
      setBalance(null);
      setStarted(false);
    }
  }

  function goTo(next: Step) {
    setError(null);
    setStep(next);
    // On a phone the next step's top may be out of sight.
    requestAnimationFrame(() =>
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  function continueFromIdentity() {
    if (values.fullName.trim().length < 2) {
      setError("Indique ton nom complet.");
      return;
    }
    if (!typedPhone) {
      setError("Indique un numéro WhatsApp valide.");
      return;
    }
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) {
      setError("Cette adresse e-mail n'est pas valide.");
      return;
    }
    if (balance?.left === 0) return;
    if (!balance && !session) {
      goTo("city");
      return;
    }
    goTo("payment");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (step === "city") {
      if (session) goTo("identity");
      return;
    }
    if (step === "identity") {
      continueFromIdentity();
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await registerForWorkshopAction({
        ...values,
        sessionId,
        amount,
        payBalance: !!balance,
      });
      if (result.full) {
        // That city just filled up: the others stay on offer.
        markClosed(sessionId);
        setSessionId("");
        setStep("city");
        setError(
          `Il n'y a plus de place${session ? ` à ${session.city}` : ""}. Choisis une autre ville, ou écris-nous sur WhatsApp.`,
        );
      } else if (result.error) setError(result.error);
      else if (result.balance) {
        setBalance(result.balance);
        setInParts(false);
      } else if (result.started) setStarted(true);
    });
  }

  if (started) {
    return (
      <div className="bg-card space-y-3 rounded-2xl border p-5 text-center">
        <CheckCircle2 className="mx-auto size-10 text-green-600" />
        <p className="font-medium">Valide le paiement sur ton téléphone.</p>
        <p className="text-muted-foreground text-sm">
          Dès qu&apos;il est confirmé, il s&apos;ajoute à ta place. Tu le verras
          sur le lien de ta réservation.
        </p>
      </div>
    );
  }

  if (!open && !balance) {
    return (
      <div className="bg-card space-y-3 rounded-2xl border p-5 text-center">
        <p className="font-medium">
          Les inscriptions en ligne sont terminées. Écris-nous sur WhatsApp.
        </p>
        {whatsappUrl && (
          <WhatsappButton url={whatsappUrl} label="Écrire sur WhatsApp" />
        )}
      </div>
    );
  }

  // A seat already held skips the city: it's the one of that seat.
  const visibleSteps = balance ? STEPS.filter((s) => s.step !== "city") : STEPS;
  const stepIndex = visibleSteps.findIndex((s) => s.step === step);

  return (
    <form
      ref={topRef}
      onSubmit={handleSubmit}
      noValidate
      className="bg-card scroll-mt-4 space-y-5 rounded-2xl border p-5"
    >
      <ol className="flex items-center gap-2" aria-label="Étapes">
        {visibleSteps.map((s, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li
              key={s.step}
              aria-current={current ? "step" : undefined}
              className="flex flex-1 items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  current &&
                    "border-brand-accent bg-brand-accent text-brand-accent-foreground",
                  done && "border-brand-accent text-brand-accent",
                  !current && !done && "text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  !current && "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < visibleSteps.length - 1 && (
                <span aria-hidden="true" className="bg-border h-px flex-1" />
              )}
            </li>
          );
        })}
      </ol>

      {step === "city" && (
        <>
          <fieldset className="space-y-2">
            <legend className="mb-1.5 font-semibold">
              Dans quelle ville ?
            </legend>
            {sessions.map((s) => (
              <label
                key={s.id}
                className={cn(
                  "has-checked:border-brand-accent has-checked:bg-brand-accent/5 flex items-start gap-3 rounded-xl border p-3",
                  s.open ? "cursor-pointer" : "opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="atelier-session"
                  disabled={!s.open}
                  className="accent-brand-accent mt-1 size-4"
                  checked={sessionId === s.id}
                  onChange={() => {
                    setSessionId(s.id);
                    setError(null);
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{s.city}</span>
                    <span className="text-sm font-semibold whitespace-nowrap">
                      {s.regularPrice > s.price && (
                        <s className="text-muted-foreground mr-1.5 text-xs decoration-red-500 decoration-2">
                          {s.regularPrice.toLocaleString("fr-FR")} F
                        </s>
                      )}
                      {s.price.toLocaleString("fr-FR")} F
                    </span>
                  </span>
                  <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
                    <CalendarDays aria-hidden="true" className="size-3.5" />
                    {s.when}
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                    {s.place}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-xs font-medium",
                      s.open ? "text-brand-accent" : "text-destructive",
                    )}
                  >
                    {s.open
                      ? `${s.remaining} place${s.remaining > 1 ? "s" : ""} restante${s.remaining > 1 ? "s" : ""}`
                      : "Complet"}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <ErrorLine error={error} />
          <Button type="submit" disabled={!session} className={primaryButton}>
            Continuer
          </Button>
        </>
      )}

      {step === "identity" && (
        <>
          {session && !balance && (
            <ChosenCity
              city={session.city}
              when={session.when}
              onChange={() => goTo("city")}
            />
          )}
          <p className="font-semibold">Tes informations</p>
          <div className="space-y-1.5">
            <Label htmlFor="atelier-name">Nom complet</Label>
            <Input
              id="atelier-name"
              autoComplete="name"
              className="h-11 text-base"
              value={values.fullName}
              onChange={(e) => set("fullName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atelier-whatsapp">Numéro WhatsApp</Label>
            <Input
              id="atelier-whatsapp"
              type="tel"
              autoComplete="tel"
              placeholder="+228 90 00 00 00"
              className="h-11 text-base"
              value={values.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atelier-email">E-mail (optionnel)</Label>
            <Input
              id="atelier-email"
              type="email"
              autoComplete="email"
              className="h-11 text-base"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          {balance && <HeldSeatNotice balance={balance} />}
          <ErrorLine error={error} />
          {balance?.left !== 0 && (
            <Button type="submit" className={primaryButton}>
              Continuer
            </Button>
          )}
          {!balance && (
            <BackButton onClick={() => goTo("city")} label="Changer de ville" />
          )}
        </>
      )}

      {step === "payment" && (
        <>
          {balance ? (
            <HeldSeatNotice balance={balance} />
          ) : (
            session && (
              <ChosenCity
                city={session.city}
                when={session.when}
                onChange={() => goTo("city")}
              />
            )
          )}

          <fieldset className="space-y-2">
            <legend className="mb-1.5 font-semibold">
              Comment veux-tu payer ?
            </legend>
            <label className="has-checked:border-brand-accent has-checked:bg-brand-accent/5 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <input
                type="radio"
                name="atelier-plan"
                className="accent-brand-accent mt-1 size-4"
                checked={!inParts}
                onChange={() => setInParts(false)}
              />
              <span className="block font-medium">
                {balance ? "Tout régler" : "Tout payer"} maintenant :{" "}
                {due.toLocaleString("fr-FR")} F
              </span>
            </label>
            <label className="has-checked:border-brand-accent has-checked:bg-brand-accent/5 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <input
                type="radio"
                name="atelier-plan"
                className="accent-brand-accent mt-1 size-4"
                checked={inParts}
                onChange={() => setInParts(true)}
              />
              <span>
                <span className="block font-medium">
                  {balance ? "Payer une partie" : "Payer un acompte"}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {balance
                    ? `Dès ${Math.min(MIN_WORKSHOP_INSTALLMENT, due).toLocaleString("fr-FR")} F. Le reste quand tu veux jusqu'au jour de la masterclass, ou sur place le jour même.`
                    : `Dès ${MIN_WORKSHOP_INSTALLMENT.toLocaleString("fr-FR")} F. Ta place est réservée dès cet acompte, et tu complètes quand tu veux jusqu'au jour de la masterclass, ou sur place le jour même.`}
                </span>
              </span>
            </label>
            {inParts && (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="atelier-part">
                  {balance
                    ? "Montant de ce versement (F CFA)"
                    : "Montant de l'acompte (F CFA)"}
                </Label>
                <Input
                  id="atelier-part"
                  type="number"
                  inputMode="numeric"
                  min={Math.min(MIN_WORKSHOP_INSTALLMENT, due)}
                  max={due}
                  step={1}
                  className="h-11 text-base"
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                />
                {amountValid && amount < due && (
                  <p className="text-muted-foreground text-xs">
                    Il te restera {(due - amount).toLocaleString("fr-FR")} F à
                    payer.
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <OperatorPicker
            name="atelier-operator"
            value={values.operator}
            onChange={(operator) => set("operator", operator)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="atelier-payment-phone">
              Numéro Mobile Money (si différent du WhatsApp)
            </Label>
            <Input
              id="atelier-payment-phone"
              type="tel"
              placeholder="90 00 00 00"
              className="h-11 text-base"
              value={values.paymentPhone}
              onChange={(e) => set("paymentPhone", e.target.value)}
            />
          </div>

          <p className="text-muted-foreground text-xs">{NON_REFUNDABLE_NOTE}</p>
          <ErrorLine error={error} />

          <Button
            type="submit"
            disabled={pending || !amountValid || !values.operator}
            className={primaryButton}
          >
            {pending ? (
              "Envoi de la demande de paiement..."
            ) : (
              <>
                <Lock className="size-5" />
                Payer {(amountValid ? amount : due).toLocaleString("fr-FR")} F
              </>
            )}
          </Button>
          <BackButton
            onClick={() => goTo("identity")}
            label="Modifier mes informations"
          />
        </>
      )}
    </form>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="text-destructive text-sm" role="alert">
      {error}
    </p>
  );
}

function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground mx-auto flex min-h-11 items-center gap-1.5 text-sm font-medium"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

// The city picked at the first step, with a way back to it.
function ChosenCity({
  city,
  when,
  onChange,
}: {
  city: string;
  when: string;
  onChange: () => void;
}) {
  return (
    <div className="bg-muted/50 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="font-semibold">{city}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {when}
        </span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="text-primary shrink-0 text-xs font-medium underline-offset-4 hover:underline"
      >
        Modifier
      </button>
    </div>
  );
}

function HeldSeatNotice({ balance }: { balance: HeldSeat }) {
  return (
    <div className="border-brand-accent/40 bg-brand-accent/5 space-y-1 rounded-xl border p-3 text-sm">
      <p className="font-medium">
        {balance.firstName}, ta place
        {balance.city ? ` à ${balance.city}` : ""} (
        {sessionDay(balance.startsAt)}) est déjà réservée.
      </p>
      {balance.left > 0 ? (
        <p>
          Il te reste <strong>{balance.left.toLocaleString("fr-FR")} F</strong>{" "}
          à payer. Tu peux tout régler maintenant, ou une partie.
        </p>
      ) : (
        <p>Elle est entièrement payée : il ne te reste rien à régler.</p>
      )}
    </div>
  );
}
