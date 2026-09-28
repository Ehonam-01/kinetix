import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SITE_NAME } from "@/config/site";
import { getAdminMfaState } from "@/services/auth/admin-mfa";
import { requireUser } from "@/services/auth/current-user";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { MfaEnrollForm, MfaVerifyForm } from "./mfa-forms";

export const metadata: Metadata = {
  title: `Double authentification — ${SITE_NAME}`,
  robots: { index: false },
};

// Where requireAdmin sends an admin session that hasn't passed its second
// factor: first-time TOTP setup, or the code prompt on every later sign-in.
export default async function MfaPage() {
  const { profile } = await requireUser();
  if (profile.role !== "ADMIN") redirect("/dashboard");

  const state = await getAdminMfaState();
  if (state.status === "verified") redirect("/admin");

  return (
    <div className="from-primary/15 via-background to-accent/40 flex min-h-screen items-center justify-center bg-linear-to-br p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-muted-foreground size-5" />
            Double authentification
          </CardTitle>
          <CardDescription>
            {state.status === "needs-enrollment"
              ? "L'accès administrateur est protégé par un second facteur. Configurez-le une fois pour continuer."
              : "Confirmez votre identité pour accéder à l'administration."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "needs-enrollment" ? (
            <MfaEnrollForm />
          ) : state.status === "needs-code" ? (
            <MfaVerifyForm />
          ) : (
            <p className="text-destructive text-sm">
              Service momentanément indisponible. Rechargez la page dans un
              instant.
            </p>
          )}
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
