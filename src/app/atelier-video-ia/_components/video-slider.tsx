"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SliderVideo = { id: string; thumbnailUrl: string };

// What a phone with "save data" on shouldn't load on its own.
function savesData() {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true;
}

const mutedSrc = (id: string) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&disablekb=1&iv_load_policy=3`;
const soundSrc = (id: string) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;

// A row of upright videos to swipe through. Each one plays muted and on a
// loop while it's on screen, and only then: a YouTube player is heavy and
// most visitors are on a phone. A tap starts it over with the sound, in a
// player loaded again with sound rather than unmuted from here, which
// iPhones and Chrome refuse without a tap inside the video. One video
// with sound at a time; it stops once scrolled out of sight.
export function VideoSlider({ videos }: { videos: SliderVideo[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<ReadonlySet<number>>(new Set());
  const [withSound, setWithSound] = useState<number | null>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const autoplay = !savesData();
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((current) => {
          const next = new Set(current);
          for (const entry of entries) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (entry.isIntersecting && autoplay) next.add(index);
            else next.delete(index);
          }
          return next;
        });
        for (const entry of entries) {
          if (entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setWithSound((current) => (current === index ? null : current));
        }
      },
      { threshold: 0.6 },
    );
    for (const card of scroller.children) observer.observe(card);

    // The arrows show only where there is something left to scroll to.
    const updateEdges = () =>
      setEdges({
        start: scroller.scrollLeft <= 4,
        end:
          scroller.scrollLeft + scroller.clientWidth >=
          scroller.scrollWidth - 4,
      });
    const resize = new ResizeObserver(updateEdges);
    resize.observe(scroller);
    scroller.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      resize.disconnect();
      scroller.removeEventListener("scroll", updateEdges);
    };
  }, [videos.length]);

  function scrollByCard(direction: 1 | -1) {
    const scroller = scrollerRef.current;
    const card = scroller?.firstElementChild as HTMLElement | null;
    if (!scroller || !card) return;
    scroller.scrollBy({
      left: direction * (card.offsetWidth + 16),
      behavior: "smooth",
    });
  }

  const arrow =
    "bg-background/90 text-foreground absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border shadow-md sm:flex";

  return (
    <div className="relative mx-auto max-w-6xl">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-[calc(50%-min(31vw,8rem))] py-2 sm:scroll-px-6 sm:px-6 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:hidden sm:[&>*:first-child]:ms-auto sm:[&>*:last-child]:me-auto"
      >
        {videos.map((video, i) => {
          const sound = withSound === i;
          const playing = sound || visible.has(i);
          return (
            <div
              key={`${video.id}-${i}`}
              data-index={i}
              className="relative aspect-[9/16] w-[62vw] max-w-64 shrink-0 snap-center overflow-hidden rounded-2xl border bg-white shadow-lg sm:w-56 sm:snap-start"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={video.thumbnailUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
              {playing && (
                <iframe
                  key={sound ? "sound" : "muted"}
                  src={sound ? soundSrc(video.id) : mutedSrc(video.id)}
                  title={`Vidéo d'exemple ${i + 1}`}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen={sound}
                  className={cn(
                    "absolute inset-0 size-full",
                    // Muted, the player only shows: the tap is ours.
                    !sound && "pointer-events-none",
                  )}
                />
              )}
              {!sound && (
                <button
                  type="button"
                  onClick={() => setWithSound(i)}
                  aria-label={`Regarder la vidéo d'exemple ${i + 1} avec le son`}
                  className="absolute inset-0 flex cursor-pointer items-end justify-center p-3"
                >
                  <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-xs font-semibold text-white">
                    <Volume2 aria-hidden="true" className="size-4" />
                    Activer le son
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!edges.start && (
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          aria-label="Vidéo précédente"
          className={cn(arrow, "left-1")}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          aria-label="Vidéo suivante"
          className={cn(arrow, "right-1")}
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}
