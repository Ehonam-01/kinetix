"use client";

import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExampleVideo = { embedUrl: string; thumbnailUrl: string };

// The fan of three cards, each with its own tilt, drifting up and down
// (kx-bob in globals.css; still for visitors who turned animations off). Fixed: always three, the
// ones without a video stay plain cards.
const CARDS = [
  "-rotate-[19deg] translate-y-[10%]",
  "rotate-1",
  "rotate-[27deg] translate-y-[14%]",
];

// Nothing from YouTube loads until a visitor taps a video: a thumbnail only,
// since most of them are on a modest phone. It then plays in a dialog, large
// enough to watch and upright, where the tilted card wouldn't be.
export function ExampleVideos({ videos }: { videos: ExampleVideo[] }) {
  const [playing, setPlaying] = useState<ExampleVideo | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (playing) dialogRef.current?.showModal();
  }, [playing]);

  return (
    <div className="mx-auto mt-8 mb-12 grid max-w-lg grid-cols-3 gap-7 px-7 sm:mt-12 sm:mb-20 sm:gap-14 sm:px-4 lg:my-0 lg:max-w-xl lg:gap-12 lg:px-6 lg:pb-14">
      {CARDS.map((tilt, i) => {
        const video = videos[i];
        const cardClass = cn(
          "aspect-[9/17] w-full overflow-hidden rounded-[18%/10%] bg-[#078F5F] motion-safe:animate-[kx-bob_4s_ease-in-out_infinite]",
          tilt,
        );
        // Out of step with each other, like a hand waving them.
        const style = { animationDelay: `${-i * 1.3}s` };
        if (!video) {
          return (
            <div
              key={i}
              aria-hidden="true"
              className={cardClass}
              style={style}
            />
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => setPlaying(video)}
            aria-label={`Regarder la vidéo d'exemple ${i + 1}`}
            className={cn(cardClass, "relative cursor-pointer")}
            style={style}
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
              <span className="flex size-10 items-center justify-center rounded-full bg-black/60 text-white sm:size-14">
                <Play className="size-5 fill-current sm:size-7" />
              </span>
            </span>
          </button>
        );
      })}

      {playing && (
        <dialog
          ref={dialogRef}
          onClose={() => setPlaying(null)}
          className="m-auto bg-transparent p-0 backdrop:bg-black/85"
        >
          <div className="relative aspect-[9/16] w-[min(90vw,48vh)]">
            <iframe
              src={`${playing.embedUrl}&autoplay=1`}
              title="Vidéo d'exemple"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="size-full rounded-2xl"
            />
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Fermer la vidéo"
            className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-black/70 text-white"
          >
            <X className="size-5" />
          </button>
        </dialog>
      )}
    </div>
  );
}
