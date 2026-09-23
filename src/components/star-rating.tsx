"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Rounds to the nearest star for the fill — the exact average is shown as
// text next to it (e.g. "4.3"), so nothing is lost, this is just the icon.
export function StarRatingDisplay({
  rating,
  className,
}: {
  rating: number;
  className?: string;
}) {
  const rounded = Math.round(rating);
  return (
    <div className={cn("flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "size-3.5",
            star <= rounded
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
          className="p-0.5"
        >
          <Star
            className={cn(
              "size-5",
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}
