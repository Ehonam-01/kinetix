"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MarketingCourseSummary } from "@/repositories/courses";
import { CourseCard } from "@/app/_components/course-card";

// Filtered in the browser: the whole catalog is already on the page, so
// the page itself stays statically generated (ISR) instead of turning
// dynamic for a ?categorie= search param.
export function CatalogGrid({
  courses,
}: {
  courses: MarketingCourseSummary[];
}) {
  const categories = [
    ...new Set(courses.flatMap((c) => (c.category ? [c.category] : []))),
  ].sort((a, b) => a.localeCompare(b, "fr"));
  const [category, setCategory] = useState<string | null>(null);
  const shown = category
    ? courses.filter((c) => c.category === category)
    : courses;

  return (
    <div className="space-y-8">
      {categories.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              {c ?? "Toutes"}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  );
}
