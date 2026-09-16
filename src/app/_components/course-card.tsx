import Link from "next/link";
import { BookOpen, Clock, GraduationCap } from "lucide-react";
import type { MarketingCourseSummary } from "@/repositories/courses";

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} h`;
}

export function CourseCard({ course }: { course: MarketingCourseSummary }) {
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group border-border bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-2xl border transition-colors"
    >
      <div className="from-primary/15 to-accent relative flex aspect-video items-center justify-center overflow-hidden bg-linear-to-br">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized course thumbnails; no next.config.ts remotePatterns configured yet since no real thumbnail exists in the catalog
          <img
            src={course.thumbnailUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <GraduationCap className="text-primary/50 size-12" />
        )}
        {course.category && (
          <span className="bg-background/90 text-foreground absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-medium">
            {course.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="group-hover:text-primary font-heading text-base font-semibold transition-colors">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm">
            {course.description}
          </p>
        )}

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <BookOpen className="size-3.5" />
            {course.moduleCount} module{course.moduleCount > 1 ? "s" : ""}
          </span>
          {course.durationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDuration(course.durationMinutes)}
            </span>
          )}
        </div>

        <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground text-xs font-medium">
            Inclus dans l&apos;abonnement
          </span>
          <span className="text-primary text-sm font-medium">
            Voir la formation →
          </span>
        </div>
      </div>
    </Link>
  );
}
