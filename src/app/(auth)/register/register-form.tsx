"use client";

import Link from "next/link";
import { MailCheck, PartyPopper } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { lookupSponsorAction, registerAction } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// The whole registration card: its header (title, "déjà inscrit ?") comes
// from the server page and gives way to a welcome screen once the account
// is created.
export function RegisterForm({
  defaultSponsorUsername,
  header,
}: {
  defaultSponsorUsername?: string;
  header: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // Set once the account is created: who to congratulate and where the
  // confirmation email went.
  const [submitted, setSubmitted] = useState<{
    firstName: string;
    email: string;
  } | null>(null);
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
        setSubmitted({
          firstName: values.fullName.trim().split(/\s+/)[0] ?? "",
          email: values.email.trim(),
        });
      }
    });
  }

  if (submitted) {
    return <RegistrationWelcome {...submitted} />;
  }

  return (
    <Card>
      {header}
      <CardContent>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="sponsorUsername">Pseudo du parrain</Label>
            <Input
              id="sponsorUsername"
              autoComplete="off"
              required
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
                <p className="text-sm text-green-600">
                  Parrain : {sponsorName}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Aucun membre ne correspond à ce pseudo.
                </p>
              ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input
              id="fullName"
              autoComplete="name"
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-destructive text-sm">
                {errors.fullName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Pseudo</Label>
            <Input id="username" autoComplete="off" {...register("username")} />
            {errors.username && (
              <p className="text-destructive text-sm">
                {errors.username.message}
              </p>
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
            <Label htmlFor="whatsapp">Numéro WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+228 90 00 00 00"
              {...register("whatsapp")}
            />
            <p className="text-muted-foreground text-xs">
              Avec l&apos;indicatif du pays. Ton parrain pourra te contacter sur
              WhatsApp pour t&apos;accompagner.
            </p>
            {errors.whatsapp && (
              <p className="text-destructive text-sm">
                {errors.whatsapp.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-sm">
                {errors.password.message}
              </p>
            )}
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
                  defaultChecked
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
                  {...register("wantsAmbassador", {
                    setValueAs: (value) => value === "true",
                  })}
                />
                Non
              </label>
            </div>
          </fieldset>
          {serverError && (
            <p className="text-destructive text-sm">{serverError}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Inscription..." : "Nous rejoindre"}
          </Button>
          <p className="text-muted-foreground text-center text-xs">
            En créant un compte, vous acceptez nos{" "}
            <Link
              href="/conditions-utilisation"
              className="underline"
              target="_blank"
            >
              conditions d&apos;utilisation
            </Link>{" "}
            et notre{" "}
            <Link href="/confidentialite" className="underline" target="_blank">
              politique de confidentialité
            </Link>
            .
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

// What a new member sees right after signing up: congratulations, and
// where the confirmation email went.
export function RegistrationWelcome({
  firstName,
  email,
}: {
  firstName: string;
  email: string;
}) {
  return (
    <Card>
      <CardContent>
        <div className="space-y-5 text-center">
          <div className="bg-brand-accent/15 mx-auto flex size-14 items-center justify-center rounded-full">
            <PartyPopper className="text-brand-accent size-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-balance">
              Félicitations
              {firstName ? ` ${firstName}` : ""}, bienvenue dans la communauté
              Kinetix !
            </h2>
            <p className="text-muted-foreground text-sm">
              Ton compte est créé. Il ne reste qu&apos;une étape pour
              l&apos;activer.
            </p>
          </div>
          <div className="border-border bg-muted/40 space-y-2 rounded-xl border p-4 text-left text-sm">
            <p className="flex items-center gap-2 font-medium">
              <MailCheck className="size-4 shrink-0 text-emerald-600" />
              Un e-mail de confirmation t&apos;a été envoyé
            </p>
            <p className="text-muted-foreground break-all">
              à <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-muted-foreground">
              Ouvre-le et clique sur le lien pour confirmer ton adresse, puis
              connecte-toi.
            </p>
          </div>
          <p className="text-muted-foreground text-xs">
            Pas reçu d&apos;ici quelques minutes ? Regarde dans les spams ou le
            courrier indésirable.
          </p>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Aller à la connexion
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
