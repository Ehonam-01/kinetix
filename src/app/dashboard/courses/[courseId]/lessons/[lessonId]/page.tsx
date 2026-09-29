import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  ListOrdered,
} from "lucide-react";
import { db } from "@/db/client";
import { getCourseContent, hasCourseAccess } from "@/repositories/courses";
import { findQuizByLessonId, findQuizQuestions } from "@/repositories/quizzes";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";
import {
  flattenLessons,
  getNeighbors,
  getProgress,
} from "@/lib/course-navigation";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { buttonVariants } from "@/components/ui/button";
import { CourseOutline } from "../../../_components/course-outline";
import { LessonContent } from "@/components/lesson-content";
import { ProgressBar } from "../../../_components/progress-bar";
import { MarkCompleteButton } from "../../mark-complete-button";
import { QuizForm } from "./quiz-form";

// The single lesson player, for video and text lessons alike: the lesson
// itself, how to complete it (button or quiz), previous/next, and the
// course outline alongside.
export default async function LessonDetailPage(
  props: PageProps<"/dashboard/courses/[courseId]/lessons/[lessonId]">,
) {
  const { courseId, lessonId } = await props.params;
  const { profile } = await requireUser();
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  // Also false for a draft course, unless the viewer is an admin.
  const access = await hasCourseAccess(db, profile.id, courseId);
  if (!access) redirect(`/dashboard/courses/${courseId}`);

  const content = await getCourseContent(db, courseId, profile.id);
  if (!content) notFound();

  const lesson = content.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId);
  if (!lesson || lesson.locked) redirect(`/dashboard/courses/${courseId}`);

  const lessons = flattenLessons(content);
  const progress = getProgress(lessons);
  const { previous, next } = getNeighbors(lessons, lessonId);
  const position = lessons.findIndex((l) => l.id === lessonId) + 1;
  const current = lessons[position - 1];

  const courseHref = `/dashboard/courses/${courseId}`;
  const lessonHref = (id: string) => `${courseHref}/lessons/${id}`;
  // After the last lesson, back to the course page — which shows the
  // end-of-course congratulations once everything is done.
  const afterHref = next ? lessonHref(next.id) : courseHref;
  const afterLabel = next ? "Leçon suivante" : "Retour à la formation";

  const embedUrl =
    lesson.lessonType === "VIDEO" && lesson.videoUrl
      ? getVideoEmbedUrl(lesson.videoProvider, lesson.videoUrl)
      : null;

  // Quizzes only exist on text lessons (services/lms/submit-quiz-attempt.ts).
  const showQuiz = lesson.lessonType === "TEXT" && lesson.hasQuiz;
  const quiz = showQuiz ? await findQuizByLessonId(db, lessonId) : null;
  const questions = quiz ? await findQuizQuestions(db, quiz.id) : [];
  // Never send isCorrect to the client — that would leak the answers into
  // the page's own React props/HTML.
  const questionsForClient = questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));

  const outlineHeader = (
    <div className="mb-4 space-y-1.5">
      <div className="text-muted-foreground flex justify-between text-xs">
        <span>
          {progress.completed} / {progress.total} leçons
        </span>
        <span>{progress.percent} %</span>
      </div>
      <ProgressBar percent={progress.percent} />
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
      <div className="min-w-0 space-y-6">
        <Link
          href={courseHref}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">{content.course.title}</span>
        </Link>

        <details className="border-border bg-card group rounded-2xl border lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
            <ListOrdered className="text-brand-accent size-4" />
            Programme du cours
            <span className="text-muted-foreground ml-auto text-xs font-normal">
              {progress.completed}/{progress.total} · {progress.percent} %
            </span>
          </summary>
          <div className="border-border border-t p-3">
            <CourseOutline
              courseId={courseId}
              lessons={lessons}
              currentLessonId={lessonId}
              compact
            />
          </div>
        </details>

        <div>
          <p className="text-brand-accent text-xs font-semibold tracking-wide uppercase">
            {current.moduleTitle} · Leçon {position}/{lessons.length}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold">{lesson.title}</h1>
          {lesson.description && (
            <p className="text-muted-foreground mt-1.5 text-sm">
              {lesson.description}
            </p>
          )}
        </div>

        {lesson.lessonType === "VIDEO" &&
          (embedUrl ? (
            <div className="overflow-hidden rounded-2xl border bg-black shadow-sm">
              <iframe
                src={embedUrl}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full"
              />
            </div>
          ) : lesson.videoUrl ? (
            <a
              href={lesson.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ExternalLink className="size-4" />
              Ouvrir la vidéo
            </a>
          ) : (
            <p className="text-muted-foreground text-sm">
              La vidéo de cette leçon n&apos;est pas encore disponible.
            </p>
          ))}

        {lesson.content && (
          <article className="border-border bg-card rounded-2xl border p-5 sm:p-8">
            <LessonContent markdown={lesson.content} />
          </article>
        )}

        {lesson.completed ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center">
            <p className="flex flex-1 items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              Leçon terminée
            </p>
            <Link href={afterHref} className={buttonVariants({ size: "sm" })}>
              {afterLabel}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : showQuiz ? (
          <section className="space-y-4">
            <h2 className="font-semibold">Quiz de validation</h2>
            <QuizForm
              courseId={courseId}
              lessonId={lessonId}
              questions={questionsForClient}
              next={{ href: afterHref, label: afterLabel }}
            />
          </section>
        ) : (
          <MarkCompleteButton
            courseId={courseId}
            lessonId={lessonId}
            nextHref={afterHref}
            label={next ? "Terminer et continuer" : "Terminer la leçon"}
          />
        )}

        <nav className="border-border flex items-stretch gap-3 border-t pt-6">
          {previous ? (
            <Link
              href={lessonHref(previous.id)}
              className="hover:bg-muted flex min-w-0 flex-1 flex-col rounded-xl border p-3 text-sm"
            >
              <span className="text-muted-foreground text-xs">← Précédente</span>
              <span className="truncate font-medium">{previous.title}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next && !next.locked ? (
            <Link
              href={lessonHref(next.id)}
              className="hover:bg-muted flex min-w-0 flex-1 flex-col rounded-xl border p-3 text-right text-sm"
            >
              <span className="text-muted-foreground text-xs">Suivante →</span>
              <span className="truncate font-medium">{next.title}</span>
            </Link>
          ) : next ? (
            <span
              className="text-muted-foreground flex min-w-0 flex-1 flex-col rounded-xl border border-dashed p-3 text-right text-sm"
              title="Réussis le quiz pour débloquer la leçon suivante."
            >
              <span className="text-xs">Suivante — après le quiz</span>
              <span className="truncate font-medium">{next.title}</span>
            </span>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      </div>

      <aside className="hidden lg:block">
        <div className="border-border bg-card sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border p-4">
          <p className="mb-3 text-sm font-semibold">Programme du cours</p>
          {outlineHeader}
          <CourseOutline
            courseId={courseId}
            lessons={lessons}
            currentLessonId={lessonId}
            compact
          />
        </div>
      </aside>
    </div>
  );
}
