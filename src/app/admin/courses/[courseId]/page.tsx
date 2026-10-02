import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { getCourseContent, getCourseStats } from "@/repositories/courses";
import { buttonVariants } from "@/components/ui/button";
import { VIDEO_PROVIDER_LABEL } from "@/lib/lesson-media-labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddLessonForm } from "./add-lesson-form";
import { AddModuleForm } from "./add-module-form";
import { CourseStatsCard } from "./course-stats-card";
import { CourseStatusForm } from "./course-status-form";
import { EditModuleForm } from "./edit-module-form";
import { EditDetailsForm } from "./edit-details-form";
import { EditPricingForm } from "./edit-pricing-form";
import { EditThumbnailForm } from "./edit-thumbnail-form";
import { MoveButtons } from "./move-buttons";
import { requireAdmin } from "@/services/auth/current-user";

export default async function AdminCourseDetailPage(
  props: PageProps<"/admin/courses/[courseId]">,
) {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const { courseId } = await props.params;
  // Hidden modules/lessons included, so they can be switched back on.
  const content = await getCourseContent(db, courseId, undefined, {
    includeInactive: true,
  });
  if (!content) notFound();
  const stats = await getCourseStats(db, courseId);

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
        <div className="flex flex-col items-end gap-2">
          <CourseStatusForm
            courseId={courseId}
            status={content.course.status}
          />
          <Link
            href={`/dashboard/courses/${courseId}`}
            target="_blank"
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            <Eye className="size-4" />
            Aperçu apprenant
          </Link>
        </div>
      </div>

      {stats && <CourseStatsCard stats={stats} />}

      <Card>
        <CardHeader>
          <CardTitle>Titre et description</CardTitle>
          <CardDescription>
            Affichés sur le catalogue, la fiche publique du cours et
            l&apos;espace membre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* key: the form starts over from the saved values once they
              change (after a save, or an edit made in another tab). */}
          <EditDetailsForm
            key={`${content.course.title}|${content.course.description ?? ""}`}
            courseId={courseId}
            currentTitle={content.course.title}
            currentDescription={content.course.description}
          />
        </CardContent>
      </Card>

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
        {content.modules.map((module, moduleIndex) => (
          <Card
            key={module.id}
            className={module.isActive ? undefined : "opacity-70"}
          >
            <CardHeader className="flex flex-row items-center gap-2">
              <MoveButtons
                courseId={courseId}
                kind="module"
                id={module.id}
                isFirst={moduleIndex === 0}
                isLast={moduleIndex === content.modules.length - 1}
              />
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
                module.lessons.map((lesson, lessonIndex) => (
                  <div
                    key={lesson.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <MoveButtons
                        courseId={courseId}
                        kind="lesson"
                        id={lesson.id}
                        isFirst={lessonIndex === 0}
                        isLast={lessonIndex === module.lessons.length - 1}
                      />
                      <span
                        className={
                          lesson.isActive
                            ? "truncate"
                            : "text-muted-foreground truncate"
                        }
                      >
                        {lesson.title}
                      </span>
                      {!lesson.isActive && (
                        <span
                          className="bg-muted text-muted-foreground flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          title="Invisible pour les apprenants"
                        >
                          <EyeOff className="size-3" />
                          Masquée
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-muted-foreground text-xs">
                        {lesson.lessonType === "TEXT"
                          ? lesson.hasQuiz
                            ? "Texte + quiz"
                            : "Texte"
                          : lesson.videoProvider
                            ? VIDEO_PROVIDER_LABEL[lesson.videoProvider]
                            : "Vidéo"}
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
