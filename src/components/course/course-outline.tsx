import Link from "next/link";
import { CheckCircle2, FileText, Lock, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavLesson } from "@/lib/course-navigation";

function LessonIcon({ lesson }: { lesson: NavLesson }) {
  if (lesson.completed) {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />;
  }
  if (lesson.locked) {
    return <Lock className="text-muted-foreground size-4 shrink-0" />;
  }
  return lesson.lessonType === "VIDEO" ? (
    <PlayCircle className="text-brand-accent size-4 shrink-0" />
  ) : (
    <FileText className="text-brand-accent size-4 shrink-0" />
  );
}

// The course's table of contents, grouped by module — on the course page
// and next to every lesson in the player. A locked lesson (behind an
// unpassed quiz) is shown but not clickable. preview lists the programme
// with nothing clickable, for a visitor without access.
export function CourseOutline({
  courseId,
  lessons,
  currentLessonId,
  compact = false,
  preview = false,
}: {
  courseId: string;
  lessons: NavLesson[];
  currentLessonId?: string;
  compact?: boolean;
  preview?: boolean;
}) {
  const modules: { id: string; title: string; lessons: NavLesson[] }[] = [];
  for (const lesson of lessons) {
    const last = modules.at(-1);
    if (last && last.id === lesson.moduleId) last.lessons.push(lesson);
    else
      modules.push({
        id: lesson.moduleId,
        title: lesson.moduleTitle,
        lessons: [lesson],
      });
  }

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      {modules.map((module, moduleIndex) => (
        <div key={module.id}>
          <p
            className={cn(
              "text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase",
            )}
          >
            Module {moduleIndex + 1} · {module.title}
          </p>
          <ul className="space-y-1">
            {module.lessons.map((lesson) => {
              const isCurrent = lesson.id === currentLessonId;
              const row = (
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isCurrent
                      ? "bg-primary/10 text-primary font-medium"
                      : preview
                        ? ""
                        : lesson.locked
                          ? "text-muted-foreground"
                          : "hover:bg-muted",
                  )}
                >
                  <LessonIcon lesson={lesson} />
                  <span className="min-w-0 flex-1">{lesson.title}</span>
                  {lesson.hasQuiz && !compact && (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
                      Quiz
                    </span>
                  )}
                </span>
              );
              return (
                <li key={lesson.id}>
                  {preview ? (
                    row
                  ) : lesson.locked ? (
                    <span
                      aria-disabled="true"
                      title="Réussis le quiz de la leçon précédente pour débloquer celle-ci."
                    >
                      {row}
                    </span>
                  ) : (
                    <Link
                      href={`/dashboard/courses/${courseId}/lessons/${lesson.id}`}
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
