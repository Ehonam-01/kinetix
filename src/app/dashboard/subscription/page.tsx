import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db/client";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { getActiveProviderKey } from "@/repositories/payment-settings";
import { findRecentPendingPayment } from "@/repositories/payments";
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
import { PendingPaymentWatcher } from "./pending-payment-watcher";
import { SubscriptionPanel } from "./subscription-panel";

export default async function SubscriptionPage() {
  const { profile } = await requireUser();
  const [status, price, activeProvider, pendingPayment] = await Promise.all([
    getSubscriptionStatus(db, profile.id),
    getCurrentParameterValue(db, "subscription.price_in_cfa"),
    getActiveProviderKey(db),
    findRecentPendingPayment(db, profile.id, "SUBSCRIPTION"),
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

      {/* Covers the hosted-checkout redirect (Moneroo, or PayDunya/Bictorys
          with no operator recognized): the member left for the provider's
          own page and comes back here with no client state left to poll —
          this is what picks the confirmation up automatically instead of
          leaving them stuck on a manual reload (see PendingPaymentWatcher). */}
      {pendingPayment && (
        <PendingPaymentWatcher paymentId={pendingPayment.id} />
      )}

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
          <SubscriptionPanel
            price={price}
            username={profile.username}
            activeProvider={activeProvider}
          />
        </CardContent>
      </Card>
    </div>
  );
}
