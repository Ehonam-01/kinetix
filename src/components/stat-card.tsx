import Link from "next/link";
import { cn } from "@/lib/utils";

const STAT_COLOR_STYLES = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
} as const;

export type StatCardColor = keyof typeof STAT_COLOR_STYLES;

export function StatCard({
  icon: Icon,
  label,
  value,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  href: string;
  color: StatCardColor;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent flex items-start gap-3 rounded-2xl border p-4 transition-colors"
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          STAT_COLOR_STYLES[color],
        )}
      >
        <Icon className="size-5" />
      </div>
      {/* No truncate: a cut-off balance or label reads as wrong/missing
          data, not just tight spacing — wrapping to 2 lines is the safer
          failure mode, and fr-FR's non-breaking thousands separator
          (toLocaleString) keeps a long amount from breaking mid-number. */}
      <div className="min-w-0 flex-1">
        <p className="text-xl font-semibold wrap-break-word">{value}</p>
        <p className="text-muted-foreground text-xs wrap-break-word">{label}</p>
      </div>
    </Link>
  );
}
