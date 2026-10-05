import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/db/client";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import {
  getActiveProviderKey,
  getSupportWhatsapp,
} from "@/repositories/payment-settings";
import { CountrySupportHint } from "@/components/support/country-support-hint";
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
import { PendingPaymentWatcher } from "./pending-payment-watcher";
import { SubscriptionPanel } from "./subscription-panel";

export default async function SubscriptionPage() {
  const { profile } = await requireUser();
  const [status, price, activeProvider, pendingPayment, supportWhatsapp] =
    await Promise.all([
      getSubscriptionStatus(db, profile.id),
      getCurrentParameterValue(db, "subscription.price_in_cfa"),
      getActiveProviderKey(db),
      findRecentPendingPayment(db, profile.id, "SUBSCRIPTION"),
      getSupportWhatsapp(db),
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status.active ? (
              <>
                <CheckCircle2 className="size-5 text-green-600" />
                Abonnement actif
              </>
            ) : status.inGracePeriod ? (
              <>
                <XCircle className="size-5 text-amber-600" />
                Abonnement expiré — période de grâce
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
              : status.inGracePeriod && status.expiresAt && status.graceEndsAt
                ? `Expiré le ${status.expiresAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}. Votre accès est maintenu jusqu'au ${status.graceEndsAt.toLocaleDateString("fr-FR", { dateStyle: "long" })} : renouvelez avant cette date pour éviter la désactivation de votre compte.`
                : status.expiresAt
                  ? `Expiré le ${status.expiresAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`
                  : "Souscrivez pour débloquer l'accès à toutes les formations."}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {status.active || status.inGracePeriod
              ? "Renouveler l'abonnement"
              : "Souscrire"}
          </CardTitle>
          <CardDescription>
            {price.toLocaleString("fr-FR")} F CFA / an.
            {status.active &&
              " Un renouvellement anticipé prolonge l'abonnement à partir de sa date d'expiration actuelle, sans perte de jours payés."}
            {status.inGracePeriod &&
              " La nouvelle année démarre à la date d'expiration de votre abonnement précédent."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SubscriptionPanel
            price={price}
            username={profile.username}
            activeProvider={activeProvider}
          />
          <CountrySupportHint whatsapp={supportWhatsapp} context="paiement" />
        </CardContent>
      </Card>
    </div>
  );
}
