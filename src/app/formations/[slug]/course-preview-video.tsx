"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import {
  CleanYouTube,
  youtubeIdOf,
} from "@/app/atelier-video-ia/_components/clean-youtube";

// The course's preview video, the way the workshop page shows its own
// (explicit user decision: YouTube's title, channel and logo bars aren't
// pretty on a sales page). Nothing loads from YouTube before a tap: the
// course's thumbnail (or the video's own) with a play button, then the
// player with those bars cropped out; a tap pauses or resumes it.
export function CoursePreviewVideo({
  embedUrl,
  thumbnailUrl,
  courseTitle,
  className = "rounded-3xl shadow-xl",
}: {
  embedUrl: string;
  thumbnailUrl: string | null;
  courseTitle: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const videoId = youtubeIdOf(embedUrl);
  const frame = `relative block aspect-video w-full overflow-hidden bg-black ${className}`;
  if (!videoId) return null;

  if (playing) {
    return (
      <div className={frame}>
        <CleanYouTube
          videoId={videoId}
          title={`Aperçu de la formation « ${courseTitle} »`}
          muted={false}
          pausable
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Regarder l'aperçu de la formation « ${courseTitle} »`}
      className={`${frame} group cursor-pointer`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage or YouTube thumbnail, no remotePatterns configured (same as course-cover.tsx) */}
      <img
        src={thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        alt=""
        decoding="async"
        className="size-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
        <span className="bg-brand-accent text-brand-accent-foreground flex size-16 items-center justify-center rounded-full shadow-lg transition-transform group-hover:scale-105 sm:size-20">
          <Play className="ml-1 size-7 fill-current sm:size-9" />
        </span>
      </span>
    </button>
  );
}
