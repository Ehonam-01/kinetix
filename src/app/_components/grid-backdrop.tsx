import { cn } from "@/lib/utils";

// The faint pinstripe grid behind bold/colored sections (hero, final CTA,
// ambassador band) — currentColor + a low opacity so it automatically
// matches each section's own text color (dark grid on light sections,
// light grid on the primary-gradient CTA) instead of needing a per-section
// color prop. Fades toward the edges via a radial mask so it reads as
// texture, not a hard-edged grid.
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 opacity-[0.07]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage:
          "radial-gradient(ellipse 90% 70% at 50% 0%, black 40%, transparent 90%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 90% 70% at 50% 0%, black 40%, transparent 90%)",
      }}
    />
  );
}
