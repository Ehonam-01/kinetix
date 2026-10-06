import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CountrySupportHint } from "@/components/support/country-support-hint";
import { PendingPaymentWatcher } from "./subscription/pending-payment-watcher";
import { SubscriptionPanel } from "./subscription/subscription-panel";
import type { PaymentOptions } from "./subscription/payment-options";
import { LogoutButton } from "./logout-button";

// Replaces the entire dashboard shell (sidebar, topbar, every nested route)
// for an account with no paid access — dashboard/layout.tsx renders this
// instead of {children} for a lapsed renewal (frozen) AND, since payment
// became mandatory before dashboard access at all (explicit product
// decision), for a member who has simply never paid yet (neverSubscribed) —
// so there is no route left to reach anything else from (explicit user
// decision: "impossible d'y accéder"). A deactivated account (past the
// grace period after expiry, repositories/subscriptions.ts) sees a
// deliberately generic message with no purchase panel — self-service
// payment no longer works past that point, only an admin can grant a fresh
// subscription (services/subscriptions/grant-subscription-credit.ts);
// neverSubscribed has no permanent variant, since the clock that drives
// permanentlyFrozen never started for an account that never subscribed.
// This distinction is never named or explained here (explicit user
// decision: "pas une information publique").
//
// For a new member this is THE payment page: it offers exactly what the
// subscription page does (payment-options.ts) — other countries, the
// installment plan, the support and the outside payment link.
export function FrozenAccountScreen({
  memberName,
  neverSubscribed = false,
  permanentlyFrozen,
  username,
  options,
}: {
  memberName: string;
  neverSubscribed?: boolean;
  permanentlyFrozen: boolean;
  username: string;
  options: PaymentOptions;
}) {
  const panel = (
    <SubscriptionPanel
      price={options.price}
      username={username}
      activeProvider={options.activeProvider}
      installments={options.installments}
      otherCountries={options.otherCountries}
    />
  );
  const expired = options.expiredPlan;

  return (
    <div className="from-primary/15 via-background to-accent/40 flex min-h-screen items-center justify-center bg-linear-to-br p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground size-5" />
            {neverSubscribed
              ? "Finalisez votre inscription"
              : "Compte inaccessible"}
          </CardTitle>
          <CardDescription>
            {permanentlyFrozen
              ? "Contactez le support pour plus d'informations."
              : neverSubscribed
                ? `Bienvenue ${memberName} ! Payez votre abonnement annuel pour accéder à la plateforme.`
                : `Bonjour ${memberName}, votre abonnement n'est plus à jour. Renouvelez-le pour retrouver l'accès à votre compte.`}
          </CardDescription>
        </CardHeader>
        {!permanentlyFrozen && (
          <CardContent className="space-y-4">
            {expired && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                Ta cagnotte a été clôturée :{" "}
                {expired.refundedAt
                  ? `ton remboursement de ${(expired.refundAmount ?? 0).toLocaleString("fr-FR")} F a été effectué.`
                  : `ton remboursement de ${(expired.refundAmount ?? 0).toLocaleString("fr-FR")} F (après frais de retrait) est en cours.`}{" "}
                Tu peux t&apos;abonner en payant en une fois.
              </p>
            )}
            {options.watchedPaymentId ? (
              <PendingPaymentWatcher
                paymentId={options.watchedPaymentId}
                fallback={panel}
              />
            ) : (
              panel
            )}
            <CountrySupportHint
              whatsapp={options.supportWhatsapp}
              context="paiement"
              alternativePaymentUrl={options.alternativePaymentUrl}
            />
          </CardContent>
        )}
        <CardContent className={permanentlyFrozen ? undefined : "pt-0"}>
          <LogoutButton />
        </CardContent>
      </Card>
    </div>
  );
}
