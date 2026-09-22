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
  // Which trimmed pseudo sponsorName actually answers — lets the render
  // below tell "no match for the current input" apart from "haven't
  // looked up the current input yet" without a second boolean, and means
  // every setState here happens inside the timeout's callback, never
  // synchronously in the effect body (react-hooks/set-state-in-effect).
  const [sponsorAnsweredFor, setSponsorAnsweredFor] = useState<string | null>(
    null,
  );

  // Debounced live lookup — fires ~400ms after the visitor stops typing,
  // not on every keystroke, so a 10-letter pseudo isn't 10 round trips.
  useEffect(() => {
    const trimmed = (sponsorUsername ?? "").trim();
    if (!trimmed) return;
    const timeout = setTimeout(() => {
      lookupSponsorAction(trimmed).then((result) => {
        setSponsorName(result.fullName);
        setSponsorAnsweredFor(trimmed);
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
          sponsorAnsweredFor === sponsorUsername.trim() &&
          (sponsorName ? (
            <p className="text-sm text-green-600">Parrain : {sponsorName}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucun membre ne correspond à ce pseudo.
            </p>
          ))}
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Souhaitez-vous aussi devenir ambassadeur ?
        </legend>
        <p className="text-muted-foreground text-xs">
          Gratuit, sans obligation d&apos;achat ni de recrutement. Activé
          automatiquement dès que l&apos;abonnement est payé (un pseudo de
          parrain ambassadeur actif est alors requis ci-dessus).
        </p>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="true"
              {...register("wantsAmbassador", {
                setValueAs: (value) => value === "true",
              })}
            />
            Oui
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="false"
              defaultChecked
              {...register("wantsAmbassador", {
                setValueAs: (value) => value === "true",
              })}
            />
            Non
          </label>
        </div>
      </fieldset>
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Inscription..." : "Nous rejoindre"}
      </Button>
    </form>
  );
}
