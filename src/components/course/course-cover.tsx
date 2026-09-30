import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// A course's thumbnail, or — when an admin hasn't uploaded one yet — a
// brand-colored placeholder, so a catalog never shows a broken or empty box.
export function CourseCover({
  thumbnailUrl,
  className,
}: {
  thumbnailUrl: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden bg-linear-to-br from-[oklch(0.3_0.12_262)] to-[oklch(0.18_0.07_262)]",
        className,
      )}
    >
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL, same unoptimized <img> as app/_components/course-card.tsx (no remotePatterns configured for next/image)
        <img
          src={thumbnailUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <BookOpen className="text-brand-accent size-10 opacity-80" />
        </div>
      )}
    </div>
  );
}
