import Link from "next/link";
import { BookOpen, Clock, GraduationCap } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import type { MarketingCourseSummary } from "@/repositories/courses";
import { formatPrice } from "@/lib/format-price";

export function CourseCard({ course }: { course: MarketingCourseSummary }) {
  return (
    <Link
      href={`/formations/${course.slug ?? course.id}`}
      className="group border-border bg-card hover:border-brand-accent/40 flex flex-col overflow-hidden rounded-3xl border shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="from-brand-accent/15 to-accent relative flex aspect-video items-center justify-center overflow-hidden bg-linear-to-br">
        {course.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, unoptimized course thumbnails; no next.config.ts remotePatterns configured yet since no real thumbnail exists in the catalog
          <img
            src={course.thumbnailUrl}
            alt={`Vignette de la formation « ${course.title} »`}
            className="size-full object-cover"
          />
        ) : (
          <GraduationCap className="text-brand-accent/50 size-12" />
        )}
        {course.category && (
          <span className="bg-background/90 text-foreground absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-medium">
            {course.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="group-hover:text-brand-accent font-heading text-base font-semibold transition-colors">
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
          {!!course.durationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatDuration(course.durationMinutes)}
            </span>
          )}
        </div>

        <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-4">
          <span className="flex flex-col">
            {course.price ? (
              <>
                {/* The value struck through, then what the course sells
                    for on its own when it does (explicit user decision). */}
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span
                    className={
                      course.salePrice !== null &&
                      course.salePrice < course.price
                        ? "text-muted-foreground text-sm font-semibold line-through"
                        : "text-muted-foreground text-lg font-semibold line-through"
                    }
                  >
                    {formatPrice(course.price)}
                  </span>
                  {course.salePrice !== null &&
                    course.salePrice < course.price && (
                      <span className="text-foreground text-lg font-bold">
                        {formatPrice(course.salePrice)}
                      </span>
                    )}
                </span>
                <span className="text-sm font-semibold text-green-600">
                  {course.salePrice !== null && course.salePrice < course.price
                    ? "ou gratuit avec l'abonnement"
                    : "Gratuit avec l'abonnement"}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm font-medium">
                Inclus dans l&apos;abonnement
              </span>
            )}
          </span>
          <span className="text-brand-accent shrink-0 text-sm font-medium">
            Voir la formation →
          </span>
        </div>
      </div>
    </Link>
  );
}
