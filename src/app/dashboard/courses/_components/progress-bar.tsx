import { cn } from "@/lib/utils";

export function ProgressBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("bg-muted h-2 overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          clamped === 100 ? "bg-emerald-500" : "bg-brand-accent",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
