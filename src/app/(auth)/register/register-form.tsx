"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { lookupSponsorAction, registerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm({
  defaultSponsorUsername,
}: {
  defaultSponsorUsername?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { sponsorUsername: defaultSponsorUsername },
  });

  const sponsorUsername = watch("sponsorUsername");
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [sponsorLookupDone, setSponsorLookupDone] = useState(false);

  // Debounced live lookup — fires ~400ms after the visitor stops typing,
  // not on every keystroke, so a 10-letter pseudo isn't 10 round trips.
  // sponsorLookupDone (rather than sponsorName !== null) is what drives
  // the "aucun parrain trouvé" message, so a still-empty result after a
  // completed lookup reads as "not found," not as "haven't looked yet."
  useEffect(() => {
    const trimmed = (sponsorUsername ?? "").trim();
    if (!trimmed) {
      setSponsorName(null);
      setSponsorLookupDone(false);
      return;
    }
    setSponsorLookupDone(false);
    const timeout = setTimeout(() => {
      lookupSponsorAction(trimmed).then((result) => {
        setSponsorName(result.fullName);
        setSponsorLookupDone(true);
      });
    }, 400);
    return () => clearTimeout(timeout);
  }, [sponsorUsername]);

  function onSubmit(values: RegisterInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (result.error) {
        setServerError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <p className="text-muted-foreground text-sm">
        Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse
        avant de vous connecter.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
        {errors.fullName && (
          <p className="text-destructive text-sm">{errors.fullName.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Pseudo</Label>
        <Input id="username" autoComplete="off" {...register("username")} />
        {errors.username && (
          <p className="text-destructive text-sm">{errors.username.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-destructive text-sm">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-destructive text-sm">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="sponsorUsername">Pseudo du parrain (facultatif)</Label>
        <Input
          id="sponsorUsername"
          autoComplete="off"
          {...register("sponsorUsername")}
        />
        {errors.sponsorUsername && (
          <p className="text-destructive text-sm">
            {errors.sponsorUsername.message}
          </p>
        )}
        {!errors.sponsorUsername &&
          sponsorUsername?.trim() &&
          sponsorLookupDone &&
          (sponsorName ? (
            <p className="text-sm text-green-600">Parrain : {sponsorName}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun membre ne correspond à ce pseudo.
            </p>
          ))}
      </div>
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Inscription..." : "Nous rejoindre"}
      </Button>
    </form>
  );
}
