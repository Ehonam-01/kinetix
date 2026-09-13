import { db } from "@/db/client";
import { getLevelStats } from "@/repositories/member-levels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminLevelsPage() {
  const stats = await getLevelStats(db);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Vue d&apos;ensemble en lecture seule — modifier la structure d&apos;un
        niveau (tailles de génération) une fois des membres en progression
        dessus changerait rétroactivement ce que « complété » signifie pour eux
        ; ce n&apos;est volontairement pas exposé ici.
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
  );
}
