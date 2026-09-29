// Pure helpers over a course's content (repositories/courses.ts's
// getCourseContent) — course order, progress, where to resume, previous/
// next lesson. Kept free of any database access so the learner pages all
// agree on the same rules and they can be unit-tested directly.

export type NavLesson = {
  id: string;
  title: string;
  lessonType: "VIDEO" | "TEXT";
  completed: boolean;
  locked: boolean;
  hasQuiz: boolean;
  moduleId: string;
  moduleTitle: string;
};

type ContentLike = {
  modules: {
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      lessonType: "VIDEO" | "TEXT";
      completed: boolean;
      locked: boolean;
      hasQuiz: boolean;
    }[];
  }[];
};

// Every lesson in true course order (module order, then lesson order).
export function flattenLessons(content: ContentLike): NavLesson[] {
  return content.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      lessonType: lesson.lessonType,
      completed: lesson.completed,
      locked: lesson.locked,
      hasQuiz: lesson.hasQuiz,
      moduleId: module.id,
      moduleTitle: module.title,
    })),
  );
}

export function getProgress(lessons: NavLesson[]) {
  const total = lessons.length;
  const completed = lessons.filter((l) => l.completed).length;
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    finished: total > 0 && completed === total,
  };
}

// Where "Continuer" leads: the first lesson not yet completed that the
// learner can actually open. null once everything is done (or when the
// only unfinished lessons are still locked behind a quiz).
export function getResumeLesson(lessons: NavLesson[]): NavLesson | null {
  return lessons.find((l) => !l.completed && !l.locked) ?? null;
}

export function getNeighbors(lessons: NavLesson[], lessonId: string) {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: index > 0 ? lessons[index - 1] : null,
    next: index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}
