"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MIN_WORKSHOP_INSTALLMENT,
  type WorkshopRegistrationInput,
} from "@/schemas/workshop";
import { registerForWorkshopAction } from "../actions";
import { NON_REFUNDABLE_NOTE } from "./content";
import { OperatorPicker } from "./payment-logos";
import { useWorkshopLive, WhatsappButton } from "./workshop-live";

type Values = Omit<WorkshopRegistrationInput, "amount">;

const EMPTY: Values = {
  fullName: "",
  whatsapp: "",
  email: "",
  operator: "" as WorkshopRegistrationInput["operator"],
  paymentPhone: "",
};

export function RegistrationForm() {
  const { open, price, whatsappUrl, markClosed } = useWorkshopLive();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY);
  // Payment in parts (explicit user decision): the whole price, or a first
  // part from MIN_WORKSHOP_INSTALLMENT, the rest later or at the door.
  const [inParts, setInParts] = useState(false);
  const [part, setPart] = useState(String(MIN_WORKSHOP_INSTALLMENT));
  const [error, setError] = useState<string | null>(null);
  const partAmount = Number(part);
  const amount = inParts ? partAmount : price;
  const amountValid =
    Number.isInteger(amount) &&
    amount >= Math.min(MIN_WORKSHOP_INSTALLMENT, price) &&
    amount <= price;

  function set(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerForWorkshopAction({ ...values, amount });
      if (result.full) markClosed();
      else if (result.error) setError(result.error);
    });
  }

  if (!open) {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card space-y-4 rounded-2xl border p-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="atelier-name">Nom complet</Label>
        <Input
          id="atelier-name"
          required
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
          required
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

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">
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
          <span>
            <span className="block font-medium">
              Tout payer maintenant : {price.toLocaleString("fr-FR")} F
            </span>
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
            <span className="block font-medium">Payer petit à petit</span>
            <span className="text-muted-foreground block text-sm">
              Dès {MIN_WORKSHOP_INSTALLMENT.toLocaleString("fr-FR")} F. Ta place
              est réservée dès ce premier versement, et tu complètes quand tu
              veux jusqu&apos;au jour de la masterclass, ou sur place le jour
              même.
            </span>
          </span>
        </label>
        {inParts && (
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="atelier-part">
              Montant de ce premier versement (F CFA)
            </Label>
            <Input
              id="atelier-part"
              required
              type="number"
              inputMode="numeric"
              min={Math.min(MIN_WORKSHOP_INSTALLMENT, price)}
              max={price}
              step={1}
              className="h-11 text-base"
              value={part}
              onChange={(e) => setPart(e.target.value)}
            />
            {amountValid && amount < price && (
              <p className="text-muted-foreground text-xs">
                Il te restera {(price - amount).toLocaleString("fr-FR")} F à
                payer.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <p className="text-muted-foreground text-xs">{NON_REFUNDABLE_NOTE}</p>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending || !amountValid}
        className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 shadow-brand-accent/30 h-auto min-h-14 w-full rounded-xl py-3 text-base font-bold whitespace-normal shadow-lg"
      >
        {pending ? (
          "Envoi de la demande de paiement..."
        ) : (
          <>
            <Lock className="size-5" />
            Payer {(amountValid ? amount : price).toLocaleString("fr-FR")} F
          </>
        )}
      </Button>
    </form>
  );
}
