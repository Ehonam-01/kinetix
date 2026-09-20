import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { listLevelProgress } from "@/repositories/member-levels";
import { listRewardCatalog } from "@/repositories/rewards";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  LOCKED: "Verrouillé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Complété",
};

export default async function LevelsPage() {
  const { profile } = await requireUser();
  if (profile.status !== "ACTIVE") redirect("/dashboard");

  const [levelProgress, rewardCatalog] = await Promise.all([
    listLevelProgress(db, profile.id),
    listRewardCatalog(db),
  ]);
  const rewardByLevel = new Map(rewardCatalog.map((r) => [r.levelCode, r]));

  return (
    <div className="space-y-6">
      {profile.becameAncestorAt && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle>🏆 Ancêtre</CardTitle>
            <CardDescription>
              Vous avez atteint le sommet du plan de compensation (niveau 5)
              le{" "}
              {profile.becameAncestorAt.toLocaleDateString("fr-FR", {
                dateStyle: "long",
              })}
              . Votre solde et l&apos;accès à la plateforme restent
              inchangés, mais vous ne recevez plus de nouvelles commissions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      <div className="space-y-4">
        {levelProgress.map((level) => {
          const reward = rewardByLevel.get(level.code);
          return (
            <Card key={level.code}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Niveau {level.code} — {level.name}
                  </CardTitle>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      level.status === "COMPLETED" &&
                        "bg-green-600/10 text-green-600",
                      level.status === "IN_PROGRESS" &&
                        "bg-primary/10 text-primary",
                      level.status === "LOCKED" &&
                        "bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[level.status]}
                  </span>
                </div>
                {level.status !== "LOCKED" && (
                  <CardDescription>
                    Débloqué le{" "}
                    {level.startedAt?.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                    {level.completedAt &&
                      ` · complété le ${level.completedAt.toLocaleDateString("fr-FR", { dateStyle: "medium" })}`}
                  </CardDescription>
                )}
              </CardHeader>
              {((level.status !== "LOCKED" && level.generations.length > 0) ||
                (level.code >= 3 && reward)) && (
                <CardContent className="space-y-4">
                  {level.status !== "LOCKED" &&
                    level.generations.length > 0 && (
                      <div className="space-y-2">
                        {level.generations.map((gen) => (
                          <div
                            key={gen.generation}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              Génération {gen.generation}
                            </span>
                            <span
                              className={
                                gen.status === "COMPLETED"
                                  ? "text-green-600"
                                  : undefined
                              }
                            >
                              {gen.currentCount} / {gen.requiredCount}
                              {gen.bvTotal > 0 &&
                                ` · ${gen.bvTotal.toLocaleString("fr-FR")} pts`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Reward preview — shown whether the level is locked,
                      in progress, or completed, so it reads as "what's
                      waiting for you" rather than only appearing after
                      the fact. Nothing renders if the admin hasn't
                      configured a reward for this level yet (migration
                      0040 cleared the old seeded placeholders). */}
                  {level.code >= 3 && reward && (
                    <div className="border-border flex items-center gap-3 rounded-xl border p-3">
                      {reward.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, no remotePatterns configured (same as course-card.tsx)
                        <img
                          src={reward.imageUrl}
                          alt=""
                          className="size-14 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-lg text-xs">
                          🎁
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {level.status === "COMPLETED"
                            ? "Récompense obtenue"
                            : "Récompense à ce niveau"}{" "}
                          · {reward.name}
                        </p>
                        {reward.description && (
                          <p className="text-muted-foreground text-xs">
                            {reward.description}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          Valeur : {reward.value.toLocaleString("fr-FR")} F CFA
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
