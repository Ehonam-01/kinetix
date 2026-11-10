import { Quote } from "lucide-react";
import { StarRatingDisplay } from "@/components/star-rating";
import type { HomeReview } from "@/services/lms/course-reviews";
import { Reveal } from "./reveal";

// Below this many real reviews the band isn't shown at all: a loop of two
// or three cards reads as empty, and it's never padded with invented ones.
export const MIN_HOME_REVIEWS = 4;

// Real learners' reviews of the courses (services/lms/course-reviews.ts
// listHomeReviews), drifting slowly sideways in an endless loop. CSS only
// (.kx-marquee in globals.css): the list is rendered twice so the loop
// joins up; the copy is hidden from screen readers. Pauses on hover; under
// reduced motion it's a plain list scrolled by hand.
export function ReviewsBand({ reviews }: { reviews: HomeReview[] }) {
  if (reviews.length < MIN_HOME_REVIEWS) return null;

  return (
    <section className="overflow-hidden py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Ce qu&apos;en disent nos apprenants
            </h2>
            <p className="text-muted-foreground mt-5 text-xl leading-relaxed text-pretty">
              Les avis laissés par les membres sur les formations qu&apos;ils
              suivent.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delayMs={100} className="mt-12">
        <div className="kx-marquee">
          <div className="kx-marquee-track">
            {[false, true].map((copy) => (
              <ul
                key={String(copy)}
                className="kx-marquee-list"
                aria-hidden={copy || undefined}
              >
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="border-border bg-card flex w-80 shrink-0 flex-col gap-4 rounded-2xl border p-6 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <StarRatingDisplay rating={review.rating} />
                      <Quote className="text-primary/30 size-6" />
                    </div>
                    <p className="line-clamp-5 leading-relaxed">
                      {review.comment}
                    </p>
                    <div className="mt-auto text-sm">
                      <p className="font-medium">{review.author}</p>
                      <p className="text-muted-foreground line-clamp-1">
                        {review.courseTitle}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
