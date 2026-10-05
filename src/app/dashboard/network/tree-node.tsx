import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export function TreeNode({
  username,
  levelName,
  variant,
}: {
  username?: string;
  levelName?: string | null;
  variant: "root" | "member" | "unqualified" | "vacant";
}) {
  if (variant === "vacant") {
    return (
      <div className="flex w-16 flex-col items-center gap-1 sm:w-20">
        <div className="border-muted-foreground/30 flex size-12 items-center justify-center rounded-full border-2 border-dashed">
          <User className="text-muted-foreground/50 size-5" />
        </div>
        <span className="text-muted-foreground text-xs">Vacant</span>
      </div>
    );
  }

  // Fixed width, so sibling subtrees are always the same width and the
  // connectors meet in the middle (binary-connector.tsx).
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1",
        // The top of the tree sits above the connectors: it can be wider.
        variant === "root" ? "max-w-40" : "w-16 sm:w-20",
      )}
    >
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full text-white shadow-sm",
          variant === "root" && "bg-orange-500",
          variant === "member" && "bg-emerald-500",
          variant === "unqualified" && "bg-muted-foreground/40",
        )}
      >
        <User className="size-6 fill-current" />
      </div>
      <span className="max-w-full truncate text-xs font-medium">
        {username}
      </span>
      {levelName && (
        <span className="text-muted-foreground text-[10px] font-medium">
          {levelName}
        </span>
      )}
    </div>
  );
}
