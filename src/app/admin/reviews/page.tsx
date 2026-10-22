import { StarRatingDisplay } from "@/components/star-rating";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/services/auth/current-user";
import { listReviewsForAdmin } from "@/services/lms/course-reviews";
import { ReviewVisibilityButton } from "./hide-button";

// Learners' reviews of the courses, most recent first: an abusive one is
// hidden (left out of every average and list, the author isn't told) and
// can be shown again.
export default async function AdminReviewsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const rows = await listReviewsForAdmin();

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {rows.length} avis (les 100 plus récents). Un avis masqué n&apos;est
        plus compté ni affiché nulle part.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucun avis pour le moment.
        </p>
      ) : (
        <div className="divide-y rounded-2xl border">
          {rows.map(({ review, courseTitle, fullName, username }) => (
            <div
              key={review.id}
              className={cn(
                "flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between",
                review.hiddenAt && "bg-muted/40 opacity-70",
              )}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StarRatingDisplay rating={review.rating} />
                  <span className="font-medium">{courseTitle}</span>
                  {review.hiddenAt && (
                    <span className="bg-muted rounded-full px-2 py-0.5 text-xs">
                      Masqué
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  {fullName} ({username}) ·{" "}
                  {review.updatedAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                </p>
                {review.comment && (
                  <p className="break-words whitespace-pre-line">
                    {review.comment}
                  </p>
                )}
              </div>
              <ReviewVisibilityButton
                reviewId={review.id}
                hidden={!!review.hiddenAt}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
