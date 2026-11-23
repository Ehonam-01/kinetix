import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; next?: string }>;
}) {
  const { error, reset, next } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connexion</CardTitle>
        <CardDescription>
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="text-primary underline underline-offset-4"
          >
            Nous rejoindre
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error === "auth_callback_failed" && (
          <p className="text-destructive text-sm">
            Le lien utilisé est invalide ou a expiré. Réessaie.
          </p>
        )}
        {error === "session_expired" && (
          <p className="text-muted-foreground text-sm">
            Session administrateur fermée après une heure d&apos;inactivité ou
            la fermeture du navigateur. Reconnecte-toi.
          </p>
        )}
        {reset === "success" && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Mot de passe mis à jour. Connecte-toi.
          </p>
        )}
        <LoginForm next={next} />
        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-muted-foreground underline underline-offset-4"
          >
            Mot de passe oublié ?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
