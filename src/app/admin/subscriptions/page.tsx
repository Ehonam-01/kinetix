import { db } from "@/db/client";
import { listSubscriptionsForAdmin } from "@/repositories/subscriptions";
import { cn } from "@/lib/utils";
import { DeleteTestSubscriptionButton } from "./delete-test-subscription-button";

export default async function AdminSubscriptionsPage() {
  const subscriptions = await listSubscriptionsForAdmin(db);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {subscriptions.length} abonnement(s)
      </p>

      {subscriptions.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun abonnement.</p>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((s) => (
            <div
              key={s.id}
              className="space-y-2 rounded-2xl border px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.buyerUsername}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.ambassadorUsername &&
                      `Attribué à ${s.ambassadorUsername} · `}
                    Du{" "}
                    {s.startedAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}{" "}
                    au{" "}
                    {s.expiresAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {s.pricePaid.toLocaleString("fr-FR")} F ·{" "}
                    {s.businessVolume.toLocaleString("fr-FR")} pts
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      s.active
                        ? "bg-green-600/10 text-green-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.active ? "Actif" : "Expiré"}
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <DeleteTestSubscriptionButton subscriptionId={s.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
