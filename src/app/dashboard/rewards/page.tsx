import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { listMemberRewards } from "@/repositories/member-rewards";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClaimRewardForm } from "./claim-reward-form";

const STATUS_LABEL: Record<string, string> = {
  ELIGIBLE: "À réclamer",
  CLAIMED: "Réclamée",
  PROCESSING: "En cours de livraison",
  DELIVERED: "Livrée",
};

export default async function RewardsPage() {
  const { profile } = await requireUser();
  if (profile.status !== "ACTIVE") redirect("/dashboard");

  const rewards = await listMemberRewards(db, profile.id);

  return (
    <div className="space-y-6">
      {rewards.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune récompense débloquée pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          {rewards.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.reward?.name ?? "Récompense"}</CardTitle>
                <CardDescription>
                  {r.reward?.description}
                  {r.reward?.rewardType === "CASH" &&
                    ` · ${r.reward.value.toLocaleString("fr-FR")} F CFA`}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">
                  {STATUS_LABEL[r.status]}
                </span>
                {r.status === "ELIGIBLE" && (
                  <ClaimRewardForm
                    memberRewardId={r.id}
                    requiresAddress={r.reward?.rewardType === "PHYSICAL"}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
