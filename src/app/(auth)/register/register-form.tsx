"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { registerAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm({
  defaultSponsorEmail,
}: {
  defaultSponsorEmail?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { sponsorEmail: defaultSponsorEmail },
  });

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
        <Label htmlFor="sponsorEmail">Email du parrain (facultatif)</Label>
        <Input
          id="sponsorEmail"
          type="email"
          autoComplete="off"
          {...register("sponsorEmail")}
        />
        {errors.sponsorEmail && (
          <p className="text-destructive text-sm">
            {errors.sponsorEmail.message}
          </p>
        )}
      </div>
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Inscription..." : "Nous rejoindre"}
      </Button>
    </form>
  );
}
