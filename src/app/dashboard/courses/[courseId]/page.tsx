import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { getCourseContent, hasCourseAccess } from "@/repositories/courses";
import { requireUser } from "@/services/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkCompleteButton } from "./mark-complete-button";
import { PurchasePanel } from "./purchase-panel";

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
    // Not accessible via a level, but still purchasable directly (section 9
    // of the master prompt: a customer can buy without ever joining the
    // program) — show a purchase prompt instead of a hard 404. A course
    // with no price stays a plain 404, exactly as before this pivot.
    const course = await db.query.courses.findFirst({
      where: eq(courses.id, courseId),
    });
    if (!course || course.price == null) notFound();

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{course.title}</h1>
          {course.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {course.description}
            </p>
          )}
        </div>
        <Card className="max-w-sm">
          <CardContent className="pt-6">
            <PurchasePanel
              courseId={courseId}
              price={course.price}
              username={profile.username}
            />
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
