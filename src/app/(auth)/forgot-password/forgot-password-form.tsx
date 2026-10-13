"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { MailCheck } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/schemas/auth";
import { forgotPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // The address the link was sent to, once sent.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.error) {
        setServerError(result.error);
      } else {
        setSentTo(values.email.trim());
      }
    });
  }

  // Never says whether the address has an account (no enumeration): the
  // same confirmation either way.
  if (sentTo) {
    return (
      <div
        role="status"
        className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center"
      >
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15">
          <MailCheck className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-base font-semibold">Vérifie ta boîte mail</p>
        <p className="text-sm leading-relaxed">
          Si un compte existe avec l&apos;adresse{" "}
          <strong className="break-all">{sentTo}</strong>, un lien pour choisir
          un nouveau mot de passe vient de lui être envoyé.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Rien reçu d&apos;ici quelques minutes ? Regarde dans les spams ou
          courriers indésirables, puis réessaie.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi..." : "Envoyer le lien de réinitialisation"}
      </Button>
    </form>
  );
}
