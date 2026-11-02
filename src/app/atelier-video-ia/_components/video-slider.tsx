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
  // Enough sets for the row to stay full while it loops, even on a wide
  // screen with few videos. A single video doesn't loop.
  const copies =
    videos.length < 2 ? 1 : Math.max(2, Math.ceil(12 / videos.length));
  const cards = Array.from({ length: copies }, () => videos).flat();

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
  }, [cards.length]);

  // Drifts slowly and endlessly: the row holds the videos several times
  // over, and once a whole set has gone by it jumps back by exactly one
  // set, which looks the same. It holds while a video plays with sound,
  // while the mouse is over the row, for a while after a swipe, a click
  // or the wheel, off screen, and for visitors who asked for less motion.
  const hoveringRef = useRef(false);
  const pausedUntilRef = useRef(0);
  const withSoundRef = useRef(withSound);
  useEffect(() => {
    withSoundRef.current = withSound;
  }, [withSound]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || copies < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const PIXELS_PER_SECOND = 55;
    // Snapping fights a scroll moved a little each frame: off while it
    // drifts, back on as soon as a hand takes over.
    const pause = () => {
      pausedUntilRef.current = Date.now() + 8000;
      scroller.style.scrollSnapType = "";
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hoveringRef.current = true;
    };
    const leave = () => {
      hoveringRef.current = false;
    };
    scroller.addEventListener("pointerdown", pause);
    scroller.addEventListener("touchstart", pause, { passive: true });
    scroller.addEventListener("wheel", pause, { passive: true });
    scroller.addEventListener("pointerenter", enter);
    scroller.addEventListener("pointerleave", leave);

    // One set's width: from the first card to its first copy.
    const setWidth = () => {
      const cards = scroller.children;
      const first = cards[0] as HTMLElement | undefined;
      const copy = cards[videos.length] as HTMLElement | undefined;
      return first && copy ? copy.offsetLeft - first.offsetLeft : 0;
    };

    let frame = 0;
    let last: number | null = null;
    let position: number | null = null;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const box = scroller.getBoundingClientRect();
      const held =
        document.hidden ||
        hoveringRef.current ||
        withSoundRef.current !== null ||
        Date.now() < pausedUntilRef.current ||
        box.bottom < 0 ||
        box.top > window.innerHeight;
      if (held) {
        last = null;
        position = null;
        return;
      }
      const width = setWidth();
      if (last === null || position === null || width <= 0) {
        scroller.style.scrollSnapType = "none";
        last = now;
        position = scroller.scrollLeft;
        return;
      }
      position += ((now - last) / 1000) * PIXELS_PER_SECOND;
      last = now;
      while (position >= width) position -= width;
      scroller.scrollLeft = position;
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("pointerdown", pause);
      scroller.removeEventListener("touchstart", pause);
      scroller.removeEventListener("wheel", pause);
      scroller.removeEventListener("pointerenter", enter);
      scroller.removeEventListener("pointerleave", leave);
    };
  }, [videos.length, copies]);

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
        {cards.map((video, i) => {
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
                  title={`Vidéo d'exemple ${(i % videos.length) + 1}`}
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
                  aria-label={`Regarder la vidéo d'exemple ${(i % videos.length) + 1} avec le son`}
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
          onClick={() => {
            pausedUntilRef.current = Date.now() + 8000;
            scrollByCard(-1);
          }}
          aria-label="Vidéo précédente"
          className={cn(arrow, "left-1")}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          onClick={() => {
            pausedUntilRef.current = Date.now() + 8000;
            scrollByCard(1);
          }}
          aria-label="Vidéo suivante"
          className={cn(arrow, "right-1")}
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  );
}
