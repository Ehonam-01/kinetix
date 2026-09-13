import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { findLessonById } from "@/repositories/courses";
import { findQuizByLessonId, findQuizQuestions } from "@/repositories/quizzes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditLessonForm } from "./edit-lesson-form";
import { QuizEditor } from "./quiz-editor";

export default async function AdminLessonDetailPage(
  props: PageProps<"/admin/courses/[courseId]/lessons/[lessonId]">,
) {
  const { courseId, lessonId } = await props.params;
  const lesson = await findLessonById(db, lessonId);
  if (!lesson) notFound();

  const quiz =
    lesson.lessonType === "TEXT"
      ? await findQuizByLessonId(db, lessonId)
      : null;
  const questions = quiz ? await findQuizQuestions(db, quiz.id) : [];

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/courses/${courseId}`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" />
        Retour au cours
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Modifier la leçon</CardTitle>
        </CardHeader>
        <CardContent>
          <EditLessonForm
            courseId={courseId}
            lessonId={lessonId}
            initial={{
              title: lesson.title,
              description: lesson.description ?? "",
              lessonType: lesson.lessonType,
              videoProvider: lesson.videoProvider ?? "YOUTUBE",
              videoUrl: lesson.videoUrl ?? "",
              content: lesson.content ?? "",
              isActive: lesson.isActive,
            }}
          />
        </CardContent>
      </Card>

      {lesson.lessonType === "TEXT" && (
        <Card>
          <CardHeader>
            <CardTitle>Quiz de compréhension</CardTitle>
          </CardHeader>
          <CardContent>
            <QuizEditor
              courseId={courseId}
              lessonId={lessonId}
              initialPassingScore={quiz?.passingScore ?? 100}
              initialQuestions={questions.map((q) => ({
                question: q.question,
                options: q.options.map((o) => ({
                  text: o.text,
                  isCorrect: o.isCorrect,
                })),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
