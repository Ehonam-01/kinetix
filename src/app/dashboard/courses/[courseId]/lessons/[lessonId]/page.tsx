import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { db } from "@/db/client";
import { getCourseContent, hasCourseAccess } from "@/repositories/courses";
import { findQuizByLessonId, findQuizQuestions } from "@/repositories/quizzes";
import { requireUser } from "@/services/auth/current-user";
import { MarkCompleteButton } from "../../mark-complete-button";
import { QuizForm } from "./quiz-form";

export default async function LessonDetailPage(
  props: PageProps<"/dashboard/courses/[courseId]/lessons/[lessonId]">,
) {
  const { courseId, lessonId } = await props.params;
  const { profile } = await requireUser();

  const access = await hasCourseAccess(db, profile.id, courseId);
  if (!access) redirect(`/dashboard/courses/${courseId}`);

  const content = await getCourseContent(db, courseId, profile.id);
  if (!content) notFound();

  const lesson = content.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId);
  // Video lessons (and anything not found/locked) don't have a page here —
  // the course overview is the only surface for those.
  if (!lesson || lesson.lessonType !== "TEXT" || lesson.locked) {
    redirect(`/dashboard/courses/${courseId}`);
  }

  const quiz = lesson.hasQuiz ? await findQuizByLessonId(db, lessonId) : null;
  const questions = quiz ? await findQuizQuestions(db, quiz.id) : [];
  // Never send isCorrect to the client — that would leak the answers into
  // the page's own React props/HTML.
  const questionsForClient = questions.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/dashboard/courses/${courseId}`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Retour au cours
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        {lesson.description && (
          <p className="text-muted-foreground mt-1 text-sm">
            {lesson.description}
          </p>
        )}
      </div>

      {lesson.content && (
        <div className="border-border bg-card rounded-2xl border p-6 text-sm leading-relaxed whitespace-pre-wrap">
          {lesson.content}
        </div>
      )}

      {lesson.completed ? (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="size-4" />
          Leçon terminée
        </div>
      ) : lesson.hasQuiz ? (
        <QuizForm
          courseId={courseId}
          lessonId={lessonId}
          questions={questionsForClient}
        />
      ) : (
        <MarkCompleteButton courseId={courseId} lessonId={lessonId} />
      )}
    </div>
  );
}
