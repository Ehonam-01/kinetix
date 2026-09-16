import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db/client";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { getSubscriptionStatus } from "@/repositories/subscriptions";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscriptionAlertBanner } from "@/components/subscription-alert-banner";
import { SubscriptionPanel } from "./subscription-panel";

export default async function SubscriptionPage() {
  const { profile } = await requireUser();
  const [status, price] = await Promise.all([
    getSubscriptionStatus(db, profile.id),
    getCurrentParameterValue(db, "subscription.price_in_cfa"),
  ]);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mon abonnement</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          L&apos;abonnement annuel donne accès à toutes les formations de la
          plateforme.
        </p>
      </div>

      <SubscriptionAlertBanner status={status} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status.active ? (
              <>
                <CheckCircle2 className="size-5 text-green-600" />
                Abonnement actif
              </>
            ) : (
              <>
                <XCircle className="text-muted-foreground size-5" />
                Aucun abonnement actif
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status.active && status.expiresAt
              ? `Valide jusqu'au ${status.expiresAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`
              : status.expiresAt
                ? `Expiré le ${status.expiresAt.toLocaleDateString("fr-FR", { dateStyle: "long" })} — l'accès aux formations est coupé.`
                : "Souscrivez pour débloquer l'accès à toutes les formations."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {status.active ? "Renouveler l'abonnement" : "Souscrire"}
          </CardTitle>
          <CardDescription>
            {price.toLocaleString("fr-FR")} F CFA / an.
            {status.active &&
              " Un renouvellement anticipé prolonge l'abonnement à partir de sa date d'expiration actuelle, sans perte de jours payés."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriptionPanel price={price} username={profile.username} />
        </CardContent>
      </Card>
    </div>
  );
}
