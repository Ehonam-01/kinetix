import { SUPPORT_STATUS_LABEL } from "@/config/support";
import { cn } from "@/lib/utils";

const STYLE = {
  OPEN: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ANSWERED: "bg-green-600/15 text-green-700 dark:text-green-400",
  CLOSED: "bg-muted text-muted-foreground",
} as const;

export function TicketStatusBadge({
  status,
  labels = SUPPORT_STATUS_LABEL,
}: {
  status: keyof typeof STYLE;
  labels?: Record<keyof typeof STYLE, string>;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLE[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
