import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SubscriptionPanel } from "./subscription/subscription-panel";
import { LogoutButton } from "./logout-button";

// Replaces the entire dashboard shell (sidebar, topbar, every nested route)
// for an account with no paid access — dashboard/layout.tsx renders this
// instead of {children} for a lapsed renewal (frozen) AND, since payment
// became mandatory before dashboard access at all (explicit product
// decision), for a member who has simply never paid yet (neverSubscribed) —
// so there is no route left to reach anything else from (explicit user
// decision: "impossible d'y accéder"). A permanently-frozen account (past 3
// months unrenewed) sees a deliberately generic message with no purchase
// panel — self-service payment no longer works past that point, only an
// admin can grant a fresh subscription
// (services/subscriptions/grant-subscription-credit.ts); neverSubscribed
// has no permanent variant, since the clock that drives permanentlyFrozen
// never started for an account that never subscribed. This distinction is
// never named or explained here (explicit user decision: "pas une
// information publique") — every blocked state just looks "blocked", most
// happen to offer a way to pay and one doesn't.
export function FrozenAccountScreen({
  memberName,
  neverSubscribed = false,
  permanentlyFrozen,
  price,
  username,
  activeProvider,
}: {
  memberName: string;
  neverSubscribed?: boolean;
  permanentlyFrozen: boolean;
  price: number;
  username: string;
  activeProvider: string;
}) {
  return (
    <div className="from-primary/15 via-background to-accent/40 flex min-h-screen items-center justify-center bg-linear-to-br p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground size-5" />
            {neverSubscribed ? "Finalisez votre inscription" : "Compte inaccessible"}
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
            <SubscriptionPanel
              price={price}
              username={username}
              activeProvider={activeProvider}
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
