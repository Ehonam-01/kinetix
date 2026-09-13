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
      <div className="flex flex-col items-center gap-1">
        <div className="border-muted-foreground/30 flex size-12 items-center justify-center rounded-full border-2 border-dashed">
          <User className="text-muted-foreground/50 size-5" />
        </div>
        <span className="text-muted-foreground text-xs">Vacant</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
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
      <span className="max-w-20 truncate text-xs font-medium">{username}</span>
      {levelName && (
        <span className="text-muted-foreground text-[10px] font-medium">
          {levelName}
        </span>
      )}
    </div>
  );
}
