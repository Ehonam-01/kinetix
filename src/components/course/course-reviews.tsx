import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { StarRatingDisplay } from "@/components/star-rating";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  author: string;
  updatedAt: Date;
};

// The learners' reviews of a course (services/lms/course-reviews.ts): the
// average, then the reviews — only real ones, nothing shown when there are
// none yet. `form` is the member's own review form (dashboard only).
export function CourseReviews({
  summary,
  reviews,
  form,
  className,
}: {
  summary: { average: number; count: number } | null;
  reviews: Review[];
  form?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card space-y-5 rounded-2xl border p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Avis des apprenants</h2>
        {summary && summary.count > 0 && (
          <div className="flex items-center gap-2">
            <Star className="size-5 fill-amber-400 text-amber-400" />
            <span className="text-lg font-bold tabular-nums">
              {summary.average.toLocaleString("fr-FR", {
                maximumFractionDigits: 1,
              })}
            </span>
            <span className="text-muted-foreground text-sm">
              / 5 · {summary.count} avis
            </span>
          </div>
        )}
      </div>

      {form}

      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun avis pour le moment.
        </p>
      ) : (
        <ul className="divide-y">
          {reviews.map((review) => (
            <li key={review.id} className="space-y-1.5 py-3 first:pt-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StarRatingDisplay rating={review.rating} />
                <span className="font-medium">{review.author}</span>
                <span className="text-muted-foreground text-xs">
                  {review.updatedAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                </span>
              </div>
              {review.comment && (
                <p className="text-muted-foreground text-sm leading-relaxed break-words whitespace-pre-line">
                  {review.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
