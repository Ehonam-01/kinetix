import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { db } from "@/db/client";
import { getCourseContent, hasCourseAccess } from "@/repositories/courses";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkCompleteButton } from "./mark-complete-button";

export default async function CourseDetailPage(
  props: PageProps<"/dashboard/courses/[courseId]">,
) {
  const { courseId } = await props.params;
  const { profile } = await requireUser();
  // Same reasoning as /dashboard/courses/page.tsx: reachable by a plain
  // customer, not just an ACTIVE ambassador.
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  const access = await hasCourseAccess(db, profile.id, courseId);
  if (!access) {
    // Every course requires an active annual subscription now (explicit
    // user decision, "remplacement complet" — see db/schema/subscriptions.ts):
    // no more per-course purchase prompt here, just a link to subscribe.
    const content = await getCourseContent(db, courseId);
    if (!content) notFound();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{content.course.title}</h1>
          {content.course.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {content.course.description}
            </p>
          )}
        </div>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="text-primary size-4" />
              Abonnement requis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Cette formation, comme toutes les autres, est incluse dans
              l&apos;abonnement annuel.
            </p>
            <Link
              href="/dashboard/subscription"
              className={cn(buttonVariants(), "w-full")}
            >
              Voir l&apos;abonnement
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const content = await getCourseContent(db, courseId, profile.id);
  if (!content) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{content.course.title}</h1>
        {content.course.description && (
          <p className="text-muted-foreground mt-1 text-sm">
            {content.course.description}
          </p>
        )}
      </div>

      {content.modules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun module pour le moment.
        </p>
      ) : (
        <div className="space-y-4">
          {content.modules.map((module) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      {lesson.locked ? (
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                          <Lock className="size-3.5" />
                          {lesson.title}
                        </span>
                      ) : lesson.lessonType === "TEXT" ? (
                        <Link
                          href={`/dashboard/courses/${courseId}/lessons/${lesson.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {lesson.title}
                        </Link>
                      ) : lesson.videoUrl ? (
                        <a
                          href={lesson.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {lesson.title}
                        </a>
                      ) : (
                        <span className="font-medium">{lesson.title}</span>
                      )}
                      {lesson.description && (
                        <p className="text-muted-foreground text-xs">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                    {lesson.locked ? (
                      <span className="text-muted-foreground text-xs">
                        Verrouillée
                      </span>
                    ) : lesson.completed ? (
                      <span className="text-xs font-medium text-green-600">
                        Terminée
                      </span>
                    ) : lesson.lessonType === "TEXT" ? (
                      <Link
                        href={`/dashboard/courses/${courseId}/lessons/${lesson.id}`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        {lesson.hasQuiz ? "Lire + quiz" : "Lire"}
                      </Link>
                    ) : (
                      <MarkCompleteButton
                        courseId={courseId}
                        lessonId={lesson.id}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
