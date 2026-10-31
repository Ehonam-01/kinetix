"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const nowInSeconds = () => Math.floor(Date.now() / 1000);
// On the server (and the first client render) there's no "now" to count
// from: the boxes show dashes, then the real time once hydrated.
const noTime = () => null;

const UNITS = [
  { label: "jours", seconds: 86400 },
  { label: "heures", seconds: 3600 },
  { label: "min", seconds: 60 },
  { label: "s", seconds: 1 },
] as const;

// Time left until the launch price ends (endsAt, the instant the new price
// applies). Disappears once it's over — the page itself switches to the
// new price at its next refresh.
export function LaunchCountdown({
  endsAt,
  className,
  boxClassName,
  labelClassName,
  label = "Temps restant avant la fin du prix de lancement",
}: {
  endsAt: string;
  label?: string;
  className?: string;
  boxClassName?: string;
  labelClassName?: string;
}) {
  const now = useSyncExternalStore(subscribe, nowInSeconds, noTime);
  const end = Math.floor(new Date(endsAt).getTime() / 1000);
  if (now !== null && now >= end) return null;

  const left = now === null ? null : end - now;
  const parts = UNITS.map((unit, i) => {
    if (left === null) return { label: unit.label, value: "––" };
    // Whole units left once the larger units are taken out (days are not
    // capped).
    const larger = i === 0 ? Infinity : UNITS[i - 1].seconds;
    const value = Math.floor((left % larger) / unit.seconds);
    return { label: unit.label, value: String(value).padStart(2, "0") };
  });

  return (
    <div
      className={cn("flex justify-center gap-2", className)}
      role="timer"
      aria-label={label}
    >
      {parts.map((part) => (
        <div
          key={part.label}
          className={cn(
            "flex min-w-14 flex-col items-center rounded-xl px-2 py-1.5",
            boxClassName,
          )}
        >
          <span className="text-xl font-bold tabular-nums sm:text-2xl">
            {part.value}
          </span>
          <span className={cn("text-[10px] uppercase", labelClassName)}>
            {part.label}
          </span>
        </div>
      ))}
    </div>
  );
}
