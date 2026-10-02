import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  ListChecks,
} from "lucide-react";
import type { getPublicCourse } from "@/repositories/courses";
import { SITE_NAME } from "@/config/site";
import { flattenLessons } from "@/lib/course-navigation";
import { cn, formatDuration } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CourseCover } from "@/components/course/course-cover";
import { CourseOutline } from "@/components/course/course-outline";
import { ShareCourse } from "@/components/course/share-course";

export type PublicCourseContent = NonNullable<
  Awaited<ReturnType<typeof getPublicCourse>>
>;

// What a visitor sees of a formation — kept apart from page.tsx (data,
// metadata, redirects) so it only depends on the content it's given.
export function PublicCourseView({
  content,
  shareUrl,
}: {
  content: PublicCourseContent;
  shareUrl: string;
}) {
  const { course } = content;

  // Titles only — every lesson shown as open, none as done: a visitor has
  // no progress, and locking is a learner-side rule.
  const lessons = flattenLessons(content).map((l) => ({
    ...l,
    completed: false,
    locked: false,
  }));
  const quizCount = lessons.filter((l) => l.hasQuiz).length;
  const memberHref = `/dashboard/courses/${course.id}`;

  // schema.org Course — lets search engines show it as a course result.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description ?? undefined,
    inLanguage: "fr",
    provider: { "@type": "Organization", name: SITE_NAME },
    ...(course.thumbnailUrl ? { image: course.thumbnailUrl } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify of our own DB fields; "<" escaped so a title can
        // never close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="from-primary/10 to-background bg-linear-to-b">
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6 lg:px-8 lg:pb-16">
          <Link
            href="/formations"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" />
            Toutes les formations
          </Link>

          <div className="mt-6 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              {course.category && (
                <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                  {course.category}
                </span>
              )}
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {course.title}
              </h1>
              {course.description && (
                <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
                  {course.description}
                </p>
              )}

              <div className="text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5">
                  <Layers className="size-4" />
                  {content.modules.length} module
                  {content.modules.length > 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen className="size-4" />
                  {lessons.length} leçon{lessons.length > 1 ? "s" : ""}
                </span>
                {!!course.durationMinutes && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {formatDuration(course.durationMinutes)}
                  </span>
                )}
                {quizCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <ListChecks className="size-4" />
                    {quizCount} quiz
                  </span>
                )}
              </div>

              <div className="mt-6">
                {course.price ? (
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-muted-foreground text-2xl font-semibold tabular-nums line-through">
                      {course.price.toLocaleString("fr-FR")} F
                    </span>
                    <span className="text-lg font-semibold text-emerald-600">
                      Gratuit avec l&apos;abonnement
                    </span>
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-emerald-600">
                    Incluse dans l&apos;abonnement annuel
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/register"
                    className={cn(buttonVariants({ size: "lg" }))}
                  >
                    Rejoindre {SITE_NAME}
                  </Link>
                  <Link
                    href={memberHref}
                    className={cn(
                      buttonVariants({ size: "lg", variant: "outline" }),
                    )}
                  >
                    Déjà membre ? Accéder à la formation
                  </Link>
                </div>
                <ShareCourse
                  url={shareUrl}
                  courseTitle={course.title}
                  className="mt-6"
                />
              </div>
            </div>

            <CourseCover
              thumbnailUrl={course.thumbnailUrl}
              className="rounded-3xl shadow-xl"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:py-16">
        <div>
          <h2 className="text-2xl font-semibold">Programme de la formation</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Le contenu des leçons est réservé aux membres abonnés.
          </p>
          <div className="border-border bg-card mt-6 rounded-2xl border p-5 sm:p-6">
            {lessons.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Le programme sera bientôt en ligne.
              </p>
            ) : (
              <CourseOutline courseId={course.id} lessons={lessons} preview />
            )}
          </div>
        </div>

        <aside className="lg:pt-14">
          <div className="border-border bg-card sticky top-24 space-y-4 rounded-2xl border p-6">
            <p className="font-semibold">Avec l&apos;abonnement annuel</p>
            <ul className="space-y-2.5 text-sm">
              {[
                "Tout le catalogue, sans payer chaque formation séparément",
                "Autant de formations que vous le souhaitez, à votre rythme",
                "Des quiz pour valider chaque étape",
                "Votre progression sauvegardée",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/register" className={cn(buttonVariants(), "w-full")}>
              Commencer maintenant
            </Link>
          </div>
        </aside>
      </section>
    </>
  );
}
