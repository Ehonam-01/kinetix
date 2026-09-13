import Link from "next/link";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function LevelSelector({
  levels,
  selectedLevel,
  viewerCurrentLevel,
}: {
  levels: { code: number; name: string }[];
  selectedLevel: number;
  viewerCurrentLevel: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {levels.map((lvl) => {
        const locked = lvl.code > viewerCurrentLevel;

        if (locked) {
          return (
            <span
              key={lvl.code}
              title="Débloqué quand vous atteindrez ce niveau"
              className="bg-muted text-muted-foreground flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
            >
              <Lock className="size-3.5" />
              Niveau {lvl.code} · {lvl.name}
            </span>
          );
        }

        return (
          <Link
            key={lvl.code}
            href={`/dashboard/network?level=${lvl.code}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              selectedLevel === lvl.code
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            Niveau {lvl.code} · {lvl.name}
          </Link>
        );
      })}
    </div>
  );
}
