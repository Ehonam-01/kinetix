import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { listCoursesForUser } from "@/repositories/courses";
import { requireUser } from "@/services/auth/current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          (c.description ?? "").toLowerCase().includes(query),
      )
    : allCourses;

  return (
    <div className="space-y-4">
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

      {courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun cours disponible pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            // Every course is public — even one not yet purchased links
            // through to its detail page, which shows the purchase prompt
            // (dashboard/courses/[courseId]/page.tsx).
            <Link key={course.id} href={`/dashboard/courses/${course.id}`}>
              <Card className="hover:bg-muted/50 transition-colors">
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  {course.description && (
                    <CardDescription>{course.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {course.totalLessons === 0
                      ? "Aucune leçon pour le moment"
                      : `${course.completedLessons} / ${course.totalLessons} leçons terminées`}
                  </span>
                  {!course.accessible && (
                    <span className="text-primary text-xs font-medium">
                      Abonnement requis
                    </span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
