import type { CSSProperties } from "react";

// Purely decorative texture for a bold/colored panel (auth split-screen,
// same spirit as GridBackdrop) — a handful of translucent rings drifting
// slowly, sized and placed by hand so none of them sit on top of the
// heading, description or photo they share the panel with. currentColor
// isn't used here (unlike GridBackdrop): a bubble reads as a bubble only
// with its own soft fill + border, not a flat silhouette.
const BUBBLES: {
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  opacity: number;
  durationS: number;
  delayS: number;
  driftPx: number;
}[] = [
  { size: 56, top: "6%", left: "8%", opacity: 0.16, durationS: 9, delayS: 0, driftPx: 10 },
  { size: 26, top: "14%", right: "12%", opacity: 0.22, durationS: 7, delayS: 1.2, driftPx: -8 },
  { size: 14, top: "34%", left: "4%", opacity: 0.3, durationS: 6, delayS: 0.6, driftPx: 6 },
  { size: 38, bottom: "16%", right: "6%", opacity: 0.14, durationS: 10, delayS: 2, driftPx: -12 },
  { size: 18, bottom: "8%", left: "14%", opacity: 0.26, durationS: 8, delayS: 0.3, driftPx: 8 },
  { size: 11, top: "56%", right: "20%", opacity: 0.3, durationS: 5.5, delayS: 1.6, driftPx: -6 },
];

export function FloatingBubbles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {BUBBLES.map((bubble, i) => (
        <span
          key={i}
          className="bg-primary-foreground/15 border-primary-foreground/25 animate-float-bubble absolute rounded-full border"
          style={
            {
              width: bubble.size,
              height: bubble.size,
              top: bubble.top,
              left: bubble.left,
              right: bubble.right,
              bottom: bubble.bottom,
              opacity: bubble.opacity,
              animationDuration: `${bubble.durationS}s`,
              animationDelay: `${bubble.delayS}s`,
              "--bubble-drift": `${bubble.driftPx}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
