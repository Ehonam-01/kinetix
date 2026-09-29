import type { CourseStats } from "@/repositories/courses";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}

// How far learners get, lesson by lesson — the bar of each lesson is the
// share of learners who completed it, so a sudden drop marks where people
// give up.
export function CourseStatsCard({ stats }: { stats: CourseStats }) {
  const completionRate =
    stats.learners === 0
      ? 0
      : Math.round((stats.finished / stats.learners) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistiques</CardTitle>
        <CardDescription>
          Membres ayant validé au moins une leçon (les admins ne sont pas
          comptés).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Apprenants" value={String(stats.learners)} />
          <Stat label="Ont terminé" value={String(stats.finished)} />
          <Stat label="Taux de complétion" value={`${completionRate} %`} />
          <Stat
            label="Progression moyenne"
            value={`${stats.averagePercent} %`}
          />
        </div>

        {stats.learners > 0 && stats.lessons.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-sm font-medium">Parcours leçon par leçon</p>
            {stats.lessons.map((lesson, index) => {
              const percent = Math.round(
                (lesson.completions / stats.learners) * 100,
              );
              return (
                <div key={lesson.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">
                        {index + 1}.
                      </span>{" "}
                      {lesson.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {lesson.completions} · {percent} %
                    </span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {lesson.quiz && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Quiz : {lesson.quiz.attempts} tentative(s) ·{" "}
                      {lesson.quiz.passRate} % de réussite ·{" "}
                      {lesson.quiz.learnersPassed} apprenant(s) validé(s)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
