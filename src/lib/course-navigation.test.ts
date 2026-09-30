import { describe, expect, it } from "vitest";
import {
  flattenLessons,
  getNeighbors,
  getProgress,
  getResumeLesson,
} from "./course-navigation";

function lesson(
  id: string,
  overrides: Partial<{ completed: boolean; locked: boolean; hasQuiz: boolean }> = {},
) {
  return {
    id,
    title: `Leçon ${id}`,
    lessonType: "TEXT" as const,
    completed: false,
    locked: false,
    hasQuiz: false,
    ...overrides,
  };
}

const content = {
  modules: [
    { id: "m1", title: "Module 1", lessons: [lesson("a", { completed: true }), lesson("b", { hasQuiz: true })] },
    { id: "m2", title: "Module 2", lessons: [lesson("c", { locked: true }), lesson("d", { locked: true })] },
  ],
};

describe("course navigation", () => {
  it("flattens lessons in course order and keeps their module", () => {
    const lessons = flattenLessons(content);
    expect(lessons.map((l) => l.id)).toEqual(["a", "b", "c", "d"]);
    expect(lessons[2]).toMatchObject({ moduleId: "m2", moduleTitle: "Module 2" });
  });

  it("computes progress", () => {
    expect(getProgress(flattenLessons(content))).toEqual({
      total: 4,
      completed: 1,
      percent: 25,
      finished: false,
    });
    expect(getProgress([])).toEqual({ total: 0, completed: 0, percent: 0, finished: false });
  });

  it("resumes at the first unfinished lesson that isn't locked", () => {
    expect(getResumeLesson(flattenLessons(content))?.id).toBe("b");
  });

  it("has nothing to resume once every lesson is done", () => {
    const done = {
      modules: [{ id: "m1", title: "M", lessons: [lesson("a", { completed: true })] }],
    };
    const lessons = flattenLessons(done);
    expect(getResumeLesson(lessons)).toBeNull();
    expect(getProgress(lessons).finished).toBe(true);
  });

  it("finds the previous and next lessons across modules", () => {
    const lessons = flattenLessons(content);
    expect(getNeighbors(lessons, "b")).toMatchObject({
      previous: { id: "a" },
      next: { id: "c" },
    });
    expect(getNeighbors(lessons, "a").previous).toBeNull();
    expect(getNeighbors(lessons, "d").next).toBeNull();
    expect(getNeighbors(lessons, "inconnu")).toEqual({ previous: null, next: null });
  });
});
