import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getCourseContent } from "@/repositories/courses";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddLessonForm } from "./add-lesson-form";
import { AddModuleForm } from "./add-module-form";
import { CourseStatusForm } from "./course-status-form";
import { EditModuleForm } from "./edit-module-form";
import { EditPricingForm } from "./edit-pricing-form";
import { EditThumbnailForm } from "./edit-thumbnail-form";

export default async function AdminCourseDetailPage(
  props: PageProps<"/admin/courses/[courseId]">,
) {
  const { courseId } = await props.params;
  const content = await getCourseContent(db, courseId);
  if (!content) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{content.course.title}</h1>
          {content.course.description && (
            <p className="text-muted-foreground mt-1 text-sm">
              {content.course.description}
            </p>
          )}
        </div>
        <CourseStatusForm courseId={courseId} status={content.course.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Miniature</CardTitle>
          <CardDescription>
            Affichée sur la page d&apos;accueil et les cartes de formation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditThumbnailForm
            courseId={courseId}
            currentThumbnailUrl={content.course.thumbnailUrl}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prix et catégorie</CardTitle>
          <CardDescription>
            Affichés sur la page d&apos;accueil et la fiche du cours.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditPricingForm
            courseId={courseId}
            currentPrice={content.course.price}
            currentCategory={content.course.category}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        {content.modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <EditModuleForm
                courseId={courseId}
                moduleId={module.id}
                currentTitle={module.title}
                currentIsActive={module.isActive}
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {module.lessons.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Aucune leçon pour le moment.
                </p>
              ) : (
                module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{lesson.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {lesson.lessonType === "TEXT"
                          ? lesson.hasQuiz
                            ? "Texte + quiz"
                            : "Texte"
                          : lesson.videoProvider}
                      </span>
                      <Link
                        href={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        Modifier
                      </Link>
                    </div>
                  </div>
                ))
              )}
              <AddLessonForm courseId={courseId} moduleId={module.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-medium">Ajouter un module</h2>
        <AddModuleForm courseId={courseId} />
      </div>
    </div>
  );
}
