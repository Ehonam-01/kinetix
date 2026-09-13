import { db } from "@/db/client";
import { listAllMemberRewards } from "@/repositories/member-rewards";
import { cn } from "@/lib/utils";
import { DeliveryStatusButton } from "./delivery-status-button";

const STATUS_LABEL: Record<string, string> = {
  ELIGIBLE: "À réclamer",
  CLAIMED: "Réclamée",
  PROCESSING: "En cours de livraison",
  DELIVERED: "Livrée",
};

export default async function AdminRewardsPage() {
  const rewards = await listAllMemberRewards(db);

  return (
    <div className="space-y-4">
      {rewards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune récompense débloquée pour le moment.
        </p>
      ) : (
        <div className="divide-y rounded-2xl border">
          {rewards.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{r.reward?.name ?? "Récompense"}</p>
                <p className="text-muted-foreground text-xs">{r.memberName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    r.status === "DELIVERED" &&
                      "bg-green-600/10 text-green-600",
                    (r.status === "CLAIMED" || r.status === "PROCESSING") &&
                      "bg-primary/10 text-primary",
                    r.status === "ELIGIBLE" && "bg-muted text-muted-foreground",
                  )}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                {r.status === "CLAIMED" && (
                  <DeliveryStatusButton
                    memberRewardId={r.id}
                    target="PROCESSING"
                    label="Marquer en cours de livraison"
                  />
                )}
                {r.status === "PROCESSING" && (
                  <DeliveryStatusButton
                    memberRewardId={r.id}
                    target="DELIVERED"
                    label="Marquer livrée"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
