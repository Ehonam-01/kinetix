import { ChevronDown, FileText, PlayCircle } from "lucide-react";
import type { NavLesson } from "@/lib/course-navigation";

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`;
}

// What each module holds, in a few words: "4 leçons · 3 vidéos · 1 quiz".
function moduleSummary(lessons: NavLesson[]) {
  const videos = lessons.filter((l) => l.lessonType === "VIDEO").length;
  const texts = lessons.length - videos;
  const quizzes = lessons.filter((l) => l.hasQuiz).length;
  const parts = [plural(lessons.length, "leçon", "leçons")];
  // Only worth saying when the module mixes both kinds.
  if (videos > 0 && texts > 0) {
    parts.push(plural(videos, "vidéo", "vidéos"));
    parts.push(plural(texts, "lecture", "lectures"));
  }
  if (quizzes > 0) parts.push(plural(quizzes, "quiz", "quiz"));
  return parts.join(" · ");
}

// The programme as a visitor sees it on the sales page: one folding block
// per module (the first one open), its lessons inside with their kind.
// Titles only, nothing clickable — the lessons are for members and buyers.
export function PublicCourseOutline({ lessons }: { lessons: NavLesson[] }) {
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
    <div className="divide-y rounded-xl border">
      {modules.map((module, index) => (
        <details key={module.id} open={index === 0} className="group">
          <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-start gap-3 px-4 py-3.5 marker:hidden sm:px-5">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                Module {index + 1} · {module.title}
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                {moduleSummary(module.lessons)}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className="text-muted-foreground mt-0.5 size-5 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <ul className="space-y-0.5 px-2 pb-3 sm:px-3">
            {module.lessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm"
              >
                {lesson.lessonType === "VIDEO" ? (
                  <PlayCircle
                    aria-label="Vidéo"
                    className="text-brand-accent size-4 shrink-0"
                  />
                ) : (
                  <FileText
                    aria-label="Lecture"
                    className="text-brand-accent size-4 shrink-0"
                  />
                )}
                <span className="min-w-0 flex-1">{lesson.title}</span>
                {lesson.hasQuiz && (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
                    Quiz
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
