import { CheckCircle2, PiggyBank, XCircle } from "lucide-react";
import { db } from "@/db/client";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import {
  getActiveProviderKey,
  getAlternativePaymentUrl,
  getSupportWhatsapp,
} from "@/repositories/payment-settings";
import { CountrySupportHint } from "@/components/support/country-support-hint";
import { findRecentPendingPayment } from "@/repositories/payments";
import { getSubscriptionStatus } from "@/repositories/subscriptions";
import { requireUser } from "@/services/auth/current-user";
import { getWithdrawalFeeSettings } from "@/repositories/withdrawals";
import { describeWithdrawalFee } from "@/lib/withdrawal-fee";
import {
  INSTALLMENT_MONTHS,
  depositBounds,
  getLatestInstallmentPlan,
  installmentIneligibility,
} from "@/services/subscriptions/installments";
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
  const [
    status,
    price,
    activeProvider,
    pendingPayment,
    pendingDeposit,
    supportWhatsapp,
    latestPlan,
    ineligibility,
    feeSettings,
    alternativePaymentUrl,
  ] = await Promise.all([
    getSubscriptionStatus(db, profile.id),
    getCurrentParameterValue(db, "subscription.price_in_cfa"),
    getActiveProviderKey(db),
    findRecentPendingPayment(db, profile.id, "SUBSCRIPTION"),
    findRecentPendingPayment(db, profile.id, "INSTALLMENT"),
    getSupportWhatsapp(db),
    getLatestInstallmentPlan(db, profile.id),
    installmentIneligibility(db, profile.id),
    getWithdrawalFeeSettings(db),
    getAlternativePaymentUrl(db),
  ]);

  // Paying in several deposits: a first subscription only, through PayDunya
  // (services/subscriptions/installments.ts).
  const openPlan = latestPlan?.status === "OPEN" ? latestPlan : null;
  const installments =
    activeProvider === "PAYDUNYA" && (openPlan || !ineligibility)
      ? {
          plan: openPlan
            ? {
                targetAmount: openPlan.targetAmount,
                paidAmount: openPlan.paidAmount,
                deadlineAt: openPlan.deadlineAt?.toISOString() ?? null,
              }
            : null,
          bounds: openPlan
            ? await depositBounds(db, openPlan)
            : { min: Math.min(1000, price), max: price },
          months: INSTALLMENT_MONTHS,
          feeLabel: describeWithdrawalFee(feeSettings),
        }
      : undefined;
  const expiredPlan = latestPlan?.status === "EXPIRED" ? latestPlan : null;
  const watchedPayment = pendingPayment ?? pendingDeposit;

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
      {watchedPayment && (
        <PendingPaymentWatcher paymentId={watchedPayment.id} />
      )}

      {expiredPlan && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="size-5 text-amber-600" />
              Cagnotte expirée
            </CardTitle>
            <CardDescription>
              Le délai pour compléter ta cagnotte est dépassé (
              {expiredPlan.paidAmount.toLocaleString("fr-FR")} F versés sur{" "}
              {expiredPlan.targetAmount.toLocaleString("fr-FR")} F) : ton
              inscription n&apos;a pas été activée.{" "}
              {expiredPlan.refundedAt
                ? `Ton remboursement de ${(expiredPlan.refundAmount ?? 0).toLocaleString("fr-FR")} F a été effectué le ${expiredPlan.refundedAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`
                : `Ton remboursement de ${(expiredPlan.refundAmount ?? 0).toLocaleString("fr-FR")} F (après ${(expiredPlan.refundFee ?? 0).toLocaleString("fr-FR")} F de frais de retrait) est en cours, sur ton compte mobile money.`}{" "}
              Tu peux toujours t&apos;abonner en payant en une fois.
            </CardDescription>
          </CardHeader>
        </Card>
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
            installments={installments}
            otherCountries={Boolean(process.env.SASPAY_SECRET_KEY)}
          />
          <CountrySupportHint
            whatsapp={supportWhatsapp}
            context="paiement"
            alternativePaymentUrl={alternativePaymentUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
