import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { db } from "@/db/client";
import { listCoursesForUser, type CourseSummary } from "@/repositories/courses";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CourseCover } from "@/components/course/course-cover";
import { ProgressBar } from "./_components/progress-bar";

function percentOf(course: CourseSummary) {
  return course.totalLessons === 0
    ? 0
    : Math.round((course.completedLessons / course.totalLessons) * 100);
}

function actionLabel(course: CourseSummary) {
  if (!course.accessible) return "Voir la formation";
  if (course.totalLessons > 0 && course.completedLessons === course.totalLessons)
    return "Revoir";
  return course.completedLessons > 0 ? "Reprendre" : "Commencer";
}

export default async function CoursesPage(
  props: PageProps<"/dashboard/courses">,
) {
  const { profile } = await requireUser();
  // Unlike the rest of /dashboard's sub-pages (network, commissions,
  // levels...), which stay ambassador-only and gated to ACTIVE, the course
  // catalog must be reachable by a plain customer who never joins the
  // program (section 9 of the master prompt) — only a SUSPENDED account is
  // blocked here.
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";

  const allCourses = await listCoursesForUser(db, profile.id);
  const courses = query
    ? allCourses.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          (c.description ?? "").toLowerCase().includes(query) ||
          (c.category ?? "").toLowerCase().includes(query),
      )
    : allCourses;

  // The one course worth a shortcut: started but not finished.
  const inProgress = query
    ? null
    : (allCourses.find(
        (c) =>
          c.accessible &&
          c.completedLessons > 0 &&
          c.completedLessons < c.totalLessons,
      ) ?? null);

  return (
    <div className="space-y-6">
      {query && (
        <p className="text-muted-foreground text-sm">
          {courses.length} résultat(s) pour « {q} »
          <Link
            href="/dashboard/courses"
            className="text-primary ml-2 underline"
          >
            réinitialiser
          </Link>
        </p>
      )}

      {inProgress && (
        <Link
          href={`/dashboard/courses/${inProgress.id}`}
          className="group border-brand-accent/30 bg-brand-accent/5 hover:bg-brand-accent/10 flex flex-col gap-4 rounded-2xl border p-4 transition-colors sm:flex-row sm:items-center sm:p-5"
        >
          <div className="bg-brand-accent/15 text-brand-accent flex size-11 shrink-0 items-center justify-center rounded-xl">
            <PlayCircle className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-medium">
              Reprendre là où tu t&apos;es arrêté
            </p>
            <p className="truncate font-semibold">{inProgress.title}</p>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar
                percent={percentOf(inProgress)}
                className="max-w-xs flex-1"
              />
              <span className="text-muted-foreground text-xs">
                {inProgress.completedLessons}/{inProgress.totalLessons} leçons
              </span>
            </div>
          </div>
          <span className="text-brand-accent flex items-center gap-1 text-sm font-semibold">
            Continuer
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune formation disponible pour le moment.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const percent = percentOf(course);
            return (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className="group border-border bg-card hover:border-brand-accent/40 flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative">
                  <CourseCover thumbnailUrl={course.thumbnailUrl} />
                  {course.category && (
                    <span className="bg-background/90 text-foreground absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-medium">
                      {course.category}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="leading-snug font-semibold">{course.title}</h2>
                  {course.description && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                      {course.description}
                    </p>
                  )}
                  <div className="mt-auto pt-4">
                    {course.accessible ? (
                      <>
                        <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
                          <span>
                            {course.totalLessons === 0
                              ? "Aucune leçon pour le moment"
                              : `${course.completedLessons} / ${course.totalLessons} leçons`}
                          </span>
                          {course.totalLessons > 0 && <span>{percent} %</span>}
                        </div>
                        <ProgressBar percent={percent} />
                      </>
                    ) : (
                      <p className="text-primary text-xs font-medium">
                        Incluse dans l&apos;abonnement
                      </p>
                    )}
                    <span
                      className={cn(
                        buttonVariants({
                          size: "sm",
                          variant: course.accessible ? "default" : "outline",
                        }),
                        "mt-4 w-full",
                      )}
                    >
                      {actionLabel(course)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
