import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { listLevelProgress } from "@/repositories/member-levels";
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

  const levelProgress = await listLevelProgress(db, profile.id);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {levelProgress.map((level) => (
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
            {level.status !== "LOCKED" && level.generations.length > 0 && (
              <CardContent className="space-y-2">
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
                        ` · ${gen.bvTotal.toLocaleString("fr-FR")} BV`}
                    </span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
