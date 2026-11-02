"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { ExampleVideo } from "./example-videos";

// The horizontal video under the top of the page. As with the example
// cards, nothing loads from YouTube before a tap: a thumbnail, then the
// player in its place. Without a link it stays an empty frame (set in
// Admin → Atelier).
export function HeroVideo({ video }: { video: ExampleVideo | null }) {
  const [playing, setPlaying] = useState(false);
  const frame =
    "relative aspect-video w-full overflow-hidden rounded-2xl border bg-white shadow-lg";
  // Floats gently until it plays: a player that moves is hard to watch.
  const floating = `${frame} motion-safe:animate-[kx-float_5s_ease-in-out_infinite]`;

  if (!video) {
    return (
      <div aria-hidden="true" className={floating}>
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-black/30 text-white sm:size-20">
            <Play className="size-7 fill-current sm:size-10" />
          </span>
        </span>
      </div>
    );
  }

  if (playing) {
    return (
      <div className={frame}>
        <iframe
          src={`${video.embedUrl}&autoplay=1`}
          title="Vidéo de présentation de l'atelier"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label="Regarder la vidéo de présentation de l'atelier"
      className={`${floating} block cursor-pointer`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={video.thumbnailUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white sm:size-20">
          <Play className="size-7 fill-current sm:size-10" />
        </span>
      </span>
    </button>
  );
}
