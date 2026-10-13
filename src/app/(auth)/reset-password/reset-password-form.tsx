"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPasswordSchema } from "@/schemas/auth";
import { resetPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const formSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

type FormInput = z.infer<typeof formSchema>;

export function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  // Accounts with two-factor authentication: the 6-digit code is asked
  // once the server says it's needed.
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormInput>({ resolver: zodResolver(formSchema) });

  function onSubmit(values: FormInput) {
    setServerError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(
        { password: values.password },
        needsMfa ? mfaCode : undefined,
      );
      if (result?.needsMfa) setNeedsMfa(true);
      if (result?.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-destructive text-sm">{errors.password.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-destructive text-sm">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>
      {needsMfa && (
        <div className="space-y-2">
          <Label htmlFor="mfaCode">Code de double authentification</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
            className="tracking-[0.3em]"
            autoFocus
          />
          <p className="text-muted-foreground text-xs">
            Le code affiché par votre application d&apos;authentification
            (Google Authenticator, Authy…).
          </p>
        </div>
      )}
      {serverError && <p className="text-destructive text-sm">{serverError}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Mise à jour..." : "Mettre à jour le mot de passe"}
      </Button>
    </form>
  );
}
