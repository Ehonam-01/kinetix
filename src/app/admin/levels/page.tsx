import { db } from "@/db/client";
import { getLevelStats } from "@/repositories/member-levels";
import { listRewardCatalog } from "@/repositories/rewards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RewardEditor } from "./reward-editor";

export default async function AdminLevelsPage() {
  const [stats, rewardCatalog] = await Promise.all([
    getLevelStats(db),
    listRewardCatalog(db),
  ]);
  const rewardByLevel = new Map(rewardCatalog.map((r) => [r.levelCode, r]));

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Vue d&apos;ensemble en lecture seule — modifier la structure d&apos;un
          niveau (tailles de génération) une fois des membres en progression
          dessus changerait rétroactivement ce que « complété » signifie pour
          eux ; ce n&apos;est volontairement pas exposé ici.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((level) => (
            <Card key={level.code} size="sm">
              <CardHeader>
                <CardTitle>Niveau {level.code}</CardTitle>
                <CardDescription>{level.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">En cours</span>
                  <span>{level.inProgress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Complété</span>
                  <span>{level.completed}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium">Récompenses matérielles</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Un membre qui complète le niveau 3, 4 ou 5 reçoit automatiquement
            la récompense active de ce niveau. Laissez un niveau sans
            récompense pour ne rien accorder à sa complétion.
          </p>
        </div>

        <div className="space-y-6">
          {[3, 4, 5].map((levelCode) => (
            <Card key={levelCode}>
              <CardHeader>
                <CardTitle>
                  Niveau {levelCode} —{" "}
                  {stats.find((s) => s.code === levelCode)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RewardEditor
                  levelCode={levelCode}
                  reward={rewardByLevel.get(levelCode) ?? null}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
