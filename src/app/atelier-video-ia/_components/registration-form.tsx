"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkshopRegistrationInput } from "@/schemas/workshop";
import { registerForWorkshopAction } from "../actions";
import { useWorkshopLive, WhatsappButton } from "./workshop-live";

const EMPTY: WorkshopRegistrationInput = {
  fullName: "",
  whatsapp: "",
  email: "",
  city: "",
  operator: "" as WorkshopRegistrationInput["operator"],
  paymentPhone: "",
};

const SELECT_CLASS =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-11 w-full rounded-lg border bg-transparent px-2.5 py-1 text-base outline-none focus-visible:ring-3";

export function RegistrationForm() {
  const { open, price, whatsappUrl, markClosed } = useWorkshopLive();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof WorkshopRegistrationInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await registerForWorkshopAction(values);
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
      <div className="space-y-1.5">
        <Label htmlFor="atelier-city">Ville</Label>
        <Input
          id="atelier-city"
          required
          autoComplete="address-level2"
          className="h-11 text-base"
          value={values.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="atelier-operator">Opérateur Mobile Money</Label>
        <select
          id="atelier-operator"
          required
          className={SELECT_CLASS}
          value={values.operator}
          onChange={(e) => set("operator", e.target.value)}
        >
          <option value="">Choisir</option>
          <option value="TOGOCELL">T-Money (Togocel)</option>
          <option value="MOOV_MONEY">Flooz (Moov Togo)</option>
        </select>
      </div>
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

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 shadow-brand-accent/30 h-auto min-h-14 w-full rounded-xl py-3 text-base font-bold whitespace-normal shadow-lg"
      >
        {pending ? (
          "Envoi de la demande de paiement..."
        ) : (
          <>
            <Lock className="size-5" />
            Payer {price.toLocaleString("fr-FR")} F
          </>
        )}
      </Button>
    </form>
  );
}
