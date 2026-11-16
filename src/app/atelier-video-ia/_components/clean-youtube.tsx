"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

// How much of the YouTube player is pushed out of the frame, above and
// below: its top bar (the video's title, the channel's name and picture)
// and its bottom one (the logo, the controls). The player is taller than
// the frame by twice this, so the video itself (letterboxed by YouTube in
// that taller player) fills the frame exactly while those bars fall
// outside it (explicit user decision: no channel name on the page).
const CROP_PX = 72;

export function youtubeEmbedSrc(
  videoId: string,
  { muted, loop }: { muted: boolean; loop?: boolean },
) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: muted ? "1" : "0",
    controls: "0",
    playsinline: "1",
    rel: "0",
    disablekb: "1",
    iv_load_policy: "3",
    fs: "0",
    // Lets this page pause and resume it (postMessage below).
    enablejsapi: "1",
  });
  // Looping one video needs it as its own playlist.
  if (loop) {
    params.set("loop", "1");
    params.set("playlist", videoId);
  }
  return `https://www.youtube.com/embed/${videoId}?${params}`;
}

// A YouTube video playing inside a frame that hides YouTube's own bars.
// The frame's size and shape come from its parent (absolute, inset 0).
// With `pausable`, a tap anywhere pauses or resumes it, the player's own
// controls being out of sight; without it, the frame lets taps through to
// whatever the parent puts on top.
export function CleanYouTube({
  videoId,
  title,
  muted,
  loop,
  pausable = false,
  className,
}: {
  videoId: string;
  title: string;
  muted: boolean;
  loop?: boolean;
  pausable?: boolean;
  className?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);

  function toggle() {
    const next = !paused;
    // YouTube's player listens to these once enablejsapi=1 is set.
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        event: "command",
        func: next ? "pauseVideo" : "playVideo",
        args: [],
      }),
      "https://www.youtube.com",
    );
    setPaused(next);
  }

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <iframe
        ref={frameRef}
        src={youtubeEmbedSrc(videoId, { muted, loop })}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture"
        className="pointer-events-none absolute inset-x-0 w-full"
        style={{ top: -CROP_PX, height: `calc(100% + ${CROP_PX * 2}px)` }}
      />
      {pausable && (
        <button
          type="button"
          onClick={toggle}
          aria-label={
            paused ? "Reprendre la vidéo" : "Mettre la vidéo en pause"
          }
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
        >
          {paused && (
            <span className="flex size-14 items-center justify-center rounded-full bg-black/60 text-white">
              <Play className="size-7 fill-current" />
            </span>
          )}
        </button>
      )}
    </div>
  );
}

// The video's id in a YouTube embed link (lib/video-embed.ts's output).
export function youtubeIdOf(embedUrl: string) {
  return embedUrl.match(/\/embed\/([\w-]+)/)?.[1] ?? null;
}
